---
layout:     post
title:      "PMA Labs Writeup: Analyzing Malicious Windows Programs"
date:       2020-08-04 15:00:00
author:     Jon Winsley
comments:   true
summary:    My analysis of the disassembly labs in Chapter 7 of "Practical Malware Analysis".
categories: malware-analysis
---

[Practical Malware Analysis](https://practicalmalwareanalysis.com/) is still a handbook for aspiring malware analysts, and while I've dabbled in the subject before, I've decided to work through the book for a better hands-on grasp of malware reverse engineering. Needless to say, this writeup will contain spoilers.

# Chapter 7: Analyzing Malicious Windows Programs

## Lab 07-01

### Static Analysis

PEView reveals no immediate signs of packing or obfuscation. There are several imports of interest, including CreateService from advapi32.dll; CreateMutex and WriteFile from kernel32.dll; and InternetOpenUrl from wininet.dll. Interesting strings include:

```plaintext
MalService
malservice
HGL345
http://www.malwareanalysisbook.com
Internet Explorer 8.0
```

These seem likely to be service names, a mutex, and a URL and user-agent. Let's find out.

### Basic Dynamic Analysis

After running Lab07_01.exe, we immediately see two HTTP GET requests to the above domain, and we also see the exe installed as a service in the registry. Process Monitor reveals that it accesses our Temporary Internet Files, History, Cookies, etc., suggesting this malware may attempt to exfiltrate our data. There is no immediate sign of this in the logged HTTP requests, but it's possible the malware is looking for a command that inetsim isn't providing.

Further analysis is needed to confirm.

### Disassembly

The main function immediately calls StartServiceCtrlDispatcher, to connect to the service control manager, and then calls `sub_401040`.

This function uses the mutex `HGL345` to ensure only one process is started. Any additional instances of the process will exit immediately. Then it creates a SystemTime object, initializing all fields to 0, and then setting the year to 0x834 (2100 decimal); sets a timer; and waits. Once the timer goes off, the function spawns 20 threads in a loop and then sleeps effectively forever.

These threads jump to 0x401150, where they simply open a connection to http[:]//www[.]malwareanalysisbook.com in a loop indefinitely.

Based on this analysis, the malware appears to be a logic bomb, set to go off in 2100 and use up system resources.

* Host-based indicators
  * Mutexes
    * HGL345
  * Services
    * Malservice
* Network-based indicators
  * Domains
    * http[:]//www[.]malwareanalysisbook.com

## Lab 07-02

### Static Analysis

This is a very compact file, though it doesn't appear to be packed. There are only a few imports of interest: OleInitialize, CoCreateInstance, and OleUninitialize from ole32.dll. It looks like this malware uses COM objects. There is one string of interest, suggesting a network component:

```plaintext
http://www.malwareanalysisbook.com/ad.html
```

### Basic Dynamic Analysis

After running the malware, Internet Explorer appears, pointed at the URL we saw in strings. No changes are immediately apparent in the Registry, and there does not appear to be any other significant network traffic. Nothing of immediate interest is highlighted by Process Monitor.

### Disassembly

After calling OleInitialize, the main function calls CoCreateInstance with the interface ID D30C1661-CDAF-11D0-8A3E-00C004FC9E26E and the clsid 0002DF01-0000-0000-C000-000000000046. IDA did not recognize and label the IID, but fortunately it's the same one referenced earlier in the chapter, and represents the IWebBrowser2 interface. The clsid, of course, is for Internet Explorer.

The application then allocates a string with the above URL, and calls a function on the interface. After adding the IWebBrowser2Vtbl interface and adjusting the offset, we see that it's the same Navigate function referenced in the book.

Then the application frees the string it had allocated, uninitializes OLE, and exits.

There is no indication that this program achieves persistence; it simply launches the browser and then exits.

## Lab 07-03

### Static Analysis

This lab has two components, an exe and a dll. Neither appears to be packed. The exe invokes some functions of kernel32 to find and copy files, so it seems likely this is the "dropper" component that installs the dll. We see the following interesting strings:

```plaintext
kerne132.dll
kernel32.dll
.exe
C:\*
C:\windows\system32\kerne132.dll
Kernel32.
Lab07-03.dll
C:\Windows\System32\Kernel32.dll
WARNING_THIS_WILL_DESTROY_YOUR_MACHINE
```

That seems ominous, but fortunately we're running a VM with up-to-date snapshots, so we should be safe...ish.

The DLL invokes some functions of kernel32 to create mutexes and processes. There are a few interesting strings here too:

```plaintext
exec
sleep
hello
127.26.152.13
SADFHUHF
```

This suggests the malware may attempt to make a network connection. Further analysis is required.

### Basic Dynamic Analysis

The exe runs, but there is no apparent effect. It doesn't seem to actually be copying the DLL, and it doesn't spin off another thread or process. It could be malfunctioning, or it could be protecting itself from analysis. Let's dig in and find out what's going on.

### Disassembly

The first thing we note is that the exe is checking for command-line arguments. If there is not exactly one command-line argument, the malware exits.

If there is an argument, the malware compares it one character at a time to the string "WARNING_THIS_WILL_DESTROY_YOUR_MACHINE". If it doesn't match, the malware exits.

Then the malware opens and creates a map of Kernel32.dll, and repeats the process for Lab07-03.dll. If that fails, it exits; otherwise, it makes a series of calls to `sub_401040`.

`sub_401040` takes three parameters: the pointer to a mapped view of a file; a value at an offset of 0x3C from the beginning of that file; and a value at an offset of 0x78 from the previous value. Since one of the calls is loading Lab07-03.dll, we pull that up in PEView and see that the value at 0x3C represents the offset to the New EXE Header (0xE0). The final parameter, 0x78 further in, points to 0x158 which is the pointer for the EXPORT Table.

`sub_401000` receives two arguments, the pointer to the export table and the pointer to the New Exe Header. It gets the number of sections from the header, then loops through each section and checks to see if the pointer to the export table is between the section's RVA and Virtual Size. If so, it returns the pointer of the section header; otherwise it returns 0. We'll call this function "getSectByAddr" to represent its behavior.

Going back to `sub_401040`, we can therefore decipher that this function is looking up the section of the given address. It uses that to calculate the offset between the raw data and the RVA (relative virtual address), and then returns the adjusted address within the mapped file view. We'll call this function "getAdjustedVirtAddr".

Following this there are a couple looping sequences which (rather than devoting more hours to this detailed level of analysis) I will guess are copying the exports from kernel32.dll into the mapped view of Lab07-03.dll. Then the mapped files are closed, and Lab07-03.dll is copied to `C:\windows\system32\kerne132.dll`.

Finally, sub_4011E0 is called, which finds the first file matching `C:\*` (but skipping `.` and `..`) and then iterates through all files, looking for ones with `.exe` in the filename, and replaces any references to `kernel32.dll` with `kerne132.dll`.

Now, let's take a look at the actual DLL and see what it does.

Diving in, we see it create a mutex with the name "SADFHUHF". It initializes WinSock, then opens a TCP stream to `127.26.152.13:80` and says "hello", then sleeps until it receives a command. If the command is `sleep`, it sleeps for one minute; if the command is `q`, it exits; if the command is `exec`, the remainder of the buffer is assumed to be the CommandLine and passed to CreateProcess.

In summary, then, when executed with the "WARNING_THIS_WILL_DESTROY_YOUR_MACHINE" command-line argument, this malware copies its own replacement of kernel32.dll with a reverse shell, and then overwrites all the executables it can find to make them load its version of kernel32.dll instead of the real one.

The simplest way to get rid of this malware temporarily would be to delete `kerne132.dll` and replace it with a copy of the legitimate `kernel32.dll`. However, this may cause issues in the future when Windows updates kernel32.dll. A more comprehensive solution would be to iterate through all .exe files and replace the string `kerne132.dll` with `kernel32.dll`. 

* Host-based indicators
  * Mutexes
    * SADFHUHF
  * Files
    * kerne132.dll
* Network-based indicators
  * IP Addresses
    * 127.26.152.13:80

# Wrap-up

I spent a lot of time digging into the details of Lab 07-03 that could have been avoided. After getting the gist of the function - that it mapped kernel32.dll and Lab07-03.dll, and did something with them - I could have taken an educated guess at the rest and then tested the hypothesis by running the malware. There wasn't much need to get into the details of what was happening with the export tables. That said, I don't feel too bad about it in this case, because it's strengthening my assembly skills.

I am also developing my malware analysis habits: naturally falling into a routine of restoring from a clean snapshot, doing static analysis, doing basic dynamic analysis, and so on. Once I finish the book, it may be useful to lay out my workflow in a final wrap-up post.