---
layout:     post
title:      PMA Labs Writeup - Chapter 3
date:       2020-07-29 15:00:00
author:     Jon Winsley
comments:   true
summary:    My analysis of the labs in Chapter 3 of "Practical Malware Analysis".
categories: malware-analysis
---

[Practical Malware Analysis](https://practicalmalwareanalysis.com/) is still a handbook for aspiring malware analysts, and while I've dabbled in the subject before, I've decided to work through the book for a better hands-on grasp of malware reverse engineering. Needless to say, this writeup will contain spoilers.

# Chapter 3: Basic Dynamic Analysis

I skipped the writeup for chapter 1's labs, which were more or less a matter of uploading samples to VirusTotal and reading the outputs. Chapter 2 dealt with setting up a virtual environment, but when I started in on the labs for Chapter 3 I realized I needed something very specific. So we'll deal with that below.

Chapter 3 starts to get into the meat of things: some basic dynamic analysis. In simple terms, running the malware to see what it does. There are a couple tools we'll use to watch how the malware interacts with the system, the disk drive, and the network.

## Lab Setup

I started with a Windows 10 VM in Hyper-V, installing the [flare-vm distribution](https://github.com/fireeye/flare-vm) from FireEye. Because my VM's disk wasn't stored on an SSD, this install took forever, and when it completed I discovered the malware samples for Lab 3 wouldn't even run in Windows 10. Chalk that one up to experience!

Instead, I found [a Windows XP VM image](https://helpdeskgeek.com/virtualization/how-to-set-up-a-windows-xp-virtual-machine-for-free/) from Microsoft, with a little effort, and set that up. I had to use a legacy network adapter to get connected to the internet.

Now I had a new conundrum, as the version of Internet Explorer (IE 6.0!) doesn't know how to speak modern ciphers, so it's unable to access much of the modern web. I changed the internet options to enable TLS 1.0, then downloaded Chrome; after running Chrome with --ignore-certificate-errors I was able to get some semblance of functionality. Some sites, such as SourceForge, I still couldn't reach, but I was able to at least get the tools referenced in the book.

After installing all the static and basic dynamic analysis tools, I set up an isolated private switch in Hyper-V to enable network without exposing the machine to the internet. I set up a static IP in the VM, shut it down, and took a snapshot.

Whew. Now we can finally get to the analysis.

## Lab 03-01

File hash: [eb84360ca4e33b8bb60df47ab5ce962501ef3420bc7aab90655fd507d2ffcedd](https://www.virustotal.com/gui/file/eb84360ca4e33b8bb60df47ab5ce962501ef3420bc7aab90655fd507d2ffcedd/detection)

### Static Analysis

PEView found no interesting imports (only ExitProcess), and PEiD suggested it was packed with Pencrypt, which is probably why.

There were some strings in the executable that looked relevant:

```
SOFTWARE\Classes\http\shell\open\commandV
Software\Microsoft\Active Setup\Installed Components\
test
 www[.]practicalmalwareanalysis.com
admin
VideoDriver
WinVMX32-
vmx32to64.exe
SOFTWARE\Microsoft\Windows\CurrentVersion\Run
SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell FoldersAppData
```

This suggests that the malware likely tries to contact the domain, and probably installs itself in the registry Run key to auto-run on startup. Let's find out.

### Dynamic Analysis

I started Process Explorer (to monitor the process trees), Process Monitor (to monitor the malware's actions), Regshot (to monitor registry changes), and ApateDNS (to intercept web requests). I took an initial snapshot with Regshot, and then I set up a preliminary filter with Process Monitor to show me only activity for the process `Lab03-01.exe`.

Then I ran the malware.

I saw nothing interesting in Process Explorer, other than the malware running in the background. Process Monitor collected a lot of entries, and after filtering down to the CreateFile records, I found it was writing to `C:\WINDOWS\system32\vmx32to64.exe` (one of the strings we found!). md5deep confirmed that this was a copy of `Lab03-01.exe`.

Regshot noted that an entry had been added to `SOFTWARE\Microsoft\Windows\CurrentVersion\Run` with the name "VideoDriver", pointing to the copied malware in system32.

Finally, ApateDNS intercepted a DNS request for `www[.]practicalmalwareanalysis.com`.

### Signatures

* Host-based signatures
  * Files
    * C:\WINDOWS\system32\vmx32to64.exe
  * Registry
    * SOFTWARE\Microsoft\Windows\CurrentVersion\Run\VideoDriver
* Network signatures
  * www[.]practicalmalwareanalysis.com


## Lab 03-02

File hash: [5eced7367ed63354b4ed5c556e2363514293f614c2c2eb187273381b2ef5f0f9](https://www.virustotal.com/gui/file/5eced7367ed63354b4ed5c556e2363514293f614c2c2eb187273381b2ef5f0f9/details)

### Static Analysis

This file is a DLL rather than an executable, but the internal structure is similar. PEView identifies that the `.data` section has a significantly larger Virtual Size than its corresponding Raw Data, suggesting some sort of packing. But the executable code itself doesn't seem to be packed.

We see imports from advapi32.dll for interacting with services and registry keys; imports from kernel32 for interacting with files; and imports from wininet.dll and ws2_32.dll for network activity.

The DLL exports five functions:

* Install
* ServiceMain
* UninstallService
* installA
* uninstallA

There are a lot of strings, but the most relevant seem to be these:

```
Y29ubmVjdA==
practicalmalwareanalysis.com
serve.html
dW5zdXBwb3J0
c2xlZXA=
Y21k
cXVpdA==
*/*
 Windows XP 6.11
CreateProcessA
kernel32.dll
.exe
GET
HTTP/1.1
%s %s
1234567890123456
quit
exit
getfile
cmd.exe /c
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
--!>
<!--
.PAX
.PAD
DependOnService
RpcSs
ServiceDll
GetModuleFileName() get dll path
Parameters
Type
Start
ObjectName
LocalSystem
ErrorControl
DisplayName
Description
Depends INA+, Collects and stores network configuration and location information
, and notifies applications when this information changes.
ImagePath
%SystemRoot%\System32\svchost.exe -k
SYSTEM\CurrentControlSet\Services\
CreateService(%s) error %d
Intranet Network Awareness (INA+)
%SystemRoot%\System32\svchost.exe -k netsvcs
OpenSCManager()
You specify service name not in Svchost//netsvcs, must be one of following:
RegQueryValueEx(Svchost\netsvcs)
netsvcs
RegOpenKeyEx(%s) KEY_QUERY_VALUE success.
RegOpenKeyEx(%s) KEY_QUERY_VALUE error .
SOFTWARE\Microsoft\Windows NT\CurrentVersion\Svchost
IPRIP
uninstall success
OpenService(%s) error 2
OpenService(%s) error 1
uninstall is starting
.?AVtype_info@@
```

### Dynamic Analysis

We'll use rundll32 to execute this DLL. Looking at the exported functions, `Install` seems the most likely candidate, so we'll start there. To set up, we'll fire up Process Monitor, Process Explorer, Regshot (taking an initial snapshot), and ApateDNS. Then:

```
rundll32 Lab03-02.dll, Install
```

An exception occurred! Let's try installA:

```
rundll32 Lab03-02.dll, installA
```

No exception this time, but did it work? Sure enough, Regshot reports several keys added to our services:

![IPRIP keys in registry](/assets/pma-3-2-1.png)

The "Intranet Network Awareness (INA+)" service is not currently running, but we can start it. Let's clear Process Monitor and see what happens when we run the service.

At first, nothing seems to happen, but after a couple minutes ApateDNS alerts that it intercepted a request to `practicalmalwareanalysis[.]com`. At the same time, Process Monitor reveals a flood of activity reading our temporary internet files, history, cookies, etc.

It seems likely that this malware is intended to steal that data and forward it on.

### Signatures

* Host-based signatures
  * Registry
    * HKLM\SYSTEM\ControlSet001\Services\IPRIP
  * Services
    * Intranet Network Awareness (INA+)
* Network signatures
  * practicalmalwareanalysis[.]com


## Lab 03-03

File hash: [ae8a1c7eb64c42ea2a04f97523ebf0844c27029eb040d910048b680f884b9dce](https://www.virustotal.com/gui/file/ae8a1c7eb64c42ea2a04f97523ebf0844c27029eb040d910048b680f884b9dce/detection)

### Static Analysis

PEView doesn't reveal any immediate signs of packing. The virtual and raw sizes of the sections line up. The imports from kernel32.dll suggest some file manipulation, and that there may be some interesting resources. And, indeed, Resource Hacker reveals what appears to be some kind of binary data. This may be the actual payload.

![Resource Hacker with some obfuscated binary data](/assets/pma-3-2-2.png)

There are some strings that suggest a user-visible popup, but nothing else of significance stands out. Let's run it and find out what it does!

### Dynamic Analysis

The first thing I notice when running it is that the process appears in Process Explorer and almost immediately disappears, leaving a new instance of `svchost.exe` running. It doesn't seem to have made any changes to the Registry, but it did create a file `practicalmalwareanalysis.log` in the same directory as the executable. This text file just lists a couple of windows that I had open at the time.

Digging into Process Monitor, it doesn't appear that the executable itself wrote that file. However, it does look like it ran `svchost.exe`, so maybe it injected the code from that resource somehow. When I filter to look at `svchost.exe` in Process Monitor, I do indeed see it looking up the executable, and also writing to the log file.

Now, what might it be doing with that log file? To test, I switched to a different Notepad window and typed some text. After re-opening the log file, sure enough, the keys I hit were saved in the log:

![practicalmalwareanalysis.log with some keylogged data](/assets/pma-3-2-3.png)

It seems clear that this malware is a keylogger which also tracks the active window and hides itself within `svchost.exe`. I did not intercept any DNS requests, so was unable to confirm if it tries to exfiltrate the data back to a C&C server.

### Signatures

* Host-based signatures
  * Files
    * practicalmalwareanalysis.log


## Lab 03-04

File hash: [6ac06dfa543dca43327d55a61d0aaed25f3c90cce791e0555e3e306d47107859](https://www.virustotal.com/gui/file/6ac06dfa543dca43327d55a61d0aaed25f3c90cce791e0555e3e306d47107859/detection)

### Static Analysis

PEView showed no immediate signs of packing: section sizes roughly lined up, and there were plenty of visible imports. PEiD confirms that it does not appear to be packed. Of particular significance among the imports, it looks like advapi32.dll is used to set some registry keys and create a service; kernel32.dll is used to interact with files, among other things; and shell32.dll to execute shell commands.

Among the strings, a few stand out:

```
NOTHING
CMD
DOWNLOAD
UPLOAD
SLEEP
cmd.exe
 >> NUL
/c del
ups
http://www.practicalmalwareanalysis.com
 Manager Service
```

These suggest some kind of commands, and also network interactivity.

### Dynamic Analysis

We start with the standard setup, taking a first capture with Regshot, filtering process monitor to the Lab03-04.exe process name, and starting ApateDNS. Then we run the malware sample.

ApateDNS doesn't immediately capture any network traffic, but the previous service example didn't capture any either. We'll assume it's installing itself as a service and leave our logging running. Regshot also shows nothing of particular interest, so we turn to Process Monitor.

Scrolling through the logs, I see an invocation of cmd.exe, so I'll add that to the filter. It looks like the malware is trying to delete itself!

```
"C:\WINDOWS\System32\cmd.exe" /c del C:\DOCUME~1\ADMINI~1\Desktop\MALWAR~1\PRACTI~1\BINARY~1\CH9F95~1\Lab03-04.exe >> NUL
```

It fails due to a sharing conflict, but this seems like a forensic countermeasure. It doesn't seem to be checking for network connectivity, but it could be checking for some other indicator - perhaps a file or registry key. We'll need to dig deeper to find out what, exactly.


# Wrap-up

How did we do? I admit I took some shortcuts here: one of the elements of dynamic analysis is network traffic monitoring, but after the hassle I went through to get the antiquated Windows XP VM set up and provisioned, I wanted to get into the action and skipped setting up an `inetsim` machine. I watched the DNS requests with ApateDNS, but didn't try intercepting network traffic with Wireshark.

After comparing my results with the answer key, this was the only hole in my analysis. I've since set up an Ubuntu inetsim server on the same private switch, so future labs will include network traffic monitoring properly!