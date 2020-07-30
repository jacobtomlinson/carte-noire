---
layout:     post
title:      "PMA Labs Writeup: IDA Pro"
date:       2020-07-30 09:00:00
author:     Jon Winsley
comments:   true
summary:    My analysis of the disassembly labs in Chapter 5 of "Practical Malware Analysis".
categories: malware-analysis
---

[Practical Malware Analysis](https://practicalmalwareanalysis.com/) is still a handbook for aspiring malware analysts, and while I've dabbled in the subject before, I've decided to work through the book for a better hands-on grasp of malware reverse engineering. Needless to say, this writeup will contain spoilers.

# Chapter 5: Basic Dynamic Analysis

For this chapter, I had to track down an older version of IDA Freeware that would still run on Windows XP. Luckily the fine folks at ScummVM got permission from HexRays to host [an older version, 5.0](https://www.scummvm.org/news/20180331/), which happens to coincide with the version used in the book. It's IDA Freeware, not IDA Pro, but we'll just have to make do.

## Lab 05-01

In this writeup, I'll follow the script of the questions a little more closely, to make sure I don't miss anything significant.

**What is the address of `DllMain`?**

We begin with `DllMain`. After loading the dll into IDA, `DllMain` is right in front of my face, and after enabling line prefixes in the General Options I can see it starts at address 0x1000D02E.

**Use the Imports window to browse to `gethostbyname`. Where is the import located?**

The import appears in the .idata section, at address 0x100163CC.

**How many functions call `gethostbyname`?**

IDA provides a graph of cross-references that call `gethostbyname`. There are five separate subroutines identified.

**Focusing on the call to `gethostbyname` located at 0x10001757, can you figure out which DNS request will be made?**

Immediately before the call, a memory address is moved into `eax` and then incremented by 0x0D (decimal 13). Looking up the memory address, we find the string `[This is RD0]pics.practicalmalwareanalysis.com`. Because the address was incremented by 13 bytes, we remove the first 13 characters and are left with `pics.practicalmalwareanalysis.com`.

**How many local variables has IDA Pro recognized for the subroutine at 0x10001656?**

This is the same subroutine we were just in. Moving the graph back to the top, I count twenty variables, recognizable by a negative offset. Some are prefixed, like `var_675`, and some have names apparently inferred, like `hModule`.

**How many parameters has IDA Pro recognized for the subroutine at 0x10001656?**

There is one parameter, with a positive offset, here labeled `arg_0`.

**Use the Strings window to locate the string `\cmd.exe /c` in the disassembly. Where is it located?**

All the way at the bottom of the list! The address is `xdoors_d:10095B34`.

**What is happening in the area of code that references `\cmd.exe /c`?**

This section of memory is referenced at location 0x100101D0. It's pushed to the stack as a parameter for `strcat` along with the local variable `CommandLine`. Based on some references to reading from a pipe, it looks like a command is being received from somewhere (probably a network connection) and then being prefixed with `\cmd.exe /c` to run the command. This is a remote shell.

**In the same area, at 0x100101C8, it looks like `dword_1008E5C4` is a global variable that helps decide which path to take. How does the malware set `dword_1008E5C4`?**

There are three references to `dword_1008E5C4`, but only one is a `mov` instruction. This is at 0x10001678. It's being set with the results of `sub_10003695`. This subroutine runs GetVersionExA and checks if dwPlatformId is 2, which [based on the documentation](https://docs.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-osversioninfoa) corresponds to VER_PLATFORM_WIN32_NT (Windows XP, 2000, etc.)

In short, it's checking if this is a 32-bit NT-based Windows. If not, it uses "command.exe" instead of "cmd.exe".

**A few hundred lines into the subroutine at 0x1000FF58, a series of comparisons use `memcmp` to compare strings. What happens if the string comparison to `robotwork` is successful (when `memcmp` returns 0)?**

This particular invocation happens at 0x10010452. If `memcmp` returns 0, it passes `s` (the sub's parameter, a socket) to `sub_100052A2`. This fetches the WorkTime from the registry, formats it into a string, and most likely sends it to the socket.

**What does the export PSLIST do?**

The first element of interest is the call to `sub_100036C3`. This checks the platform version: if the platform is not NT 32-bit, or the major version is less than 5, the export calls `sub_10006518`; otherwise it calls `sub_1000664C`.

The first subroutine, `sub_10006518`, collects information about all system processes, lists the processes' modules, and then writes them to a file. I am not sure where the filename is coming from, however, because the reference `[ebp-11Ch]` doesn't line up with a recognized variable. I suspect it's pointing to a section of the process's data to generate the filename. Perhaps further analysis will shed more light on this.

The second subroutine, `sub_1000664C`, also collects information about all system processes, but in this case it writes the output to the socket instead.

**Use the graph mode to graph the cross-references from `sub_10004E79`. Which API functions could be called by entering this function? Based on the API functions alone, what could you rename this function?**

![Graph of cross-references from sub_10004E79](/assets/pma-5-1-1.png)

The API functions shown in the graph are `GetSystemDefaultLangID`, `sprintf`, `send`, `malloc`, `free`, `strlen`, and `__imp_strlen`. Based on this information alone, I'd rename this function `GetSystemLanguage`.

**How many Windows API functions does DllMain call directly? How many at a depth of 2?**

I created a user-defined cross-reference chart, excluding library functions, and found four direct external calls. At a depth of 2, I found 33.

**At 0x10001358, there is a call to `Sleep` (an API function that takes one parameter containing the number of milliseconds to sleep). Looking backward through the code, how long will the program sleep if this code executes?**

Looking backwards through the code, we see that the value of `eax` is multiplied by 0x03E8 (1,000 in decimal). Its previous value was therefore in seconds. This is returned from `atoi`, which converts a string to an integer. That call's parameter is a pointer to the value stored at the address in `off_10019020` plus 13 characters (whew). Following this down the rabbit hole, we find that IDA has incorrectly identified these bytes as code rather than data! After converting it to data and undefining it, we're able to see the actual value: 30.

The program will therefore sleep for 30 seconds.

**At 0x10001701 is a call to `socket`. What are the three parameters?**

IDA identifies them as (translating to pseudocode):

```
socket(af=2, type=1, protocol=6)
```

**Using the MSDN page for `socket` and the named symbolic constants functionality in IDA Pro, can you make the parameters more meaningful? What are the parameters after you apply changes?**

After referencing [the MSDN page](https://docs.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-socket) (and double-checking my parameter order), I assigned symbolic constants:

![Symbolic constants AF_INET, SOCK_STREAM, and IPPROTO_TCP respectively](/assets/pma-5-1-2.png)

**Search for usage of the `in` instruction (opcode `0xED`). This instruction is used with a magic string `VMXh` to perform VMware detection. Is that in use in this malware? Using the cross-references to the function that executes the `in` instruction, is there further evidence of VMware detection?**

The `in` instruction can be found at 0x100061DB. The `eax` register is populated by a hardcoded hex value, 0x564d5868, which in ASCII translates to `VMXh`. Following the cross-references, we find that the output of this function is tested and, if not zero, loads an error message "Found Virtual Machine,Install Cancel."

This implies that, indeed, the malware aborts its install in a VMware instance.

**Jump your cursor to 0x1001D988. What do you find?**

A string of apparently random mostly-ASCII values.

**If you have the IDA Python plug-in installed...**

I don't; so let's see if there's another way to do this.

The Python file contains the following:

```py
sea = ScreenEA()

for i in range(0x00,0x50):
        b = Byte(sea+i)
        decoded_byte = b ^ 0x55
        PatchByte(sea+i,decoded_byte)
```

Clearly, it is XORing each byte in this sequence with 0x55, and replacing it. Let's try translating this into IDC (borrowing heavily from [this example](https://www.hex-rays.com/products/ida/support/tutorials/idc/decrypt/)):

```plaintext
static decrypt(from) {
  auto i, x;
  for ( i=0; i < 0x50; i=i+1 ) { 
    x = Byte(from);
    x = (x^0x55);
    PatchByte(from,x);
    from = from + 1;
  } 
}
```

After importing and compiling this script, I can run it using Shift+F2:

```plaintext
decrypt(0x1001D988)
```

Then I can convert the bytes into a string in the display. The results:

```plaintext
xdoor is this backdoor, string decoded for Practical Malware Analysis Lab :)1234
```

# Wrap-up

After comparing with the answer key, the main gap in my analysis was an incomplete understanding of PSLIST. The answer key notes that the export can be used to get information about a particular process name, not just all process names; I missed this in my review. But, with practice, I should improve at translating the logic on the fly.