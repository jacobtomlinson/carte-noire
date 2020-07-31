---
layout:     post
title:      "PMA Labs Writeup: Recognizing Code Constructs"
date:       2020-07-30 21:00:00
author:     Jon Winsley
comments:   true
summary:    My analysis of the disassembly labs in Chapter 6 of "Practical Malware Analysis".
categories: malware-analysis
---

[Practical Malware Analysis](https://practicalmalwareanalysis.com/) is still a handbook for aspiring malware analysts, and while I've dabbled in the subject before, I've decided to work through the book for a better hands-on grasp of malware reverse engineering. Needless to say, this writeup will contain spoilers.

# Chapter 6: Recognizing C Code Constructs in Assembly

It's fascinating to get a closer look at the translation between recognizable C code and the corresponding assembly code. I am used to thinking of the assembly code as some obscure and arcane transmutation of something actually readable, but this chapter brings home that the underlying patterns are still there and are still intelligible - with some effort.


## Lab 06-01

The code is quite short. It's easy to pick out the subroutine call in main and jump to it. There we see that the subroutine is calling InternetGetConnectedState and, based on the results, uses an if-then construct to call `sub_40105F` with a different message depending on whether the Internet is connected.

That subroutine seems to create a string buffer in a global variable with the success or error message. I conjecture that `sub_401282` is a print routine like `sprintf` that can do some parsing; but after a couple hours of hunting for clues I am not certain. In the Wrap-up section we'll see what the answer key has to say.

Then the application returns 1, if the Internet is connected, or 0, if it is not.


## Lab 06-02

Like the first lab, this malware sample starts by checking the internet connection state. It creates a buffer, enters that large and mysterious tangle of code, and then seems to write it to file (?). Then if it returns 0 (no internet connection), the process ends; otherwise, it calls `sub_401040`.

That subroutine opens an Internet connection to `http[:]//www[.]practicalmalwareanalysis.com/cc.htm` in an attempt to fetch a command. It uses a jump table to make sure the first four bytes are 0x3C 0x21 0x2D 0x2D, and returns a variety of error messages in case of failure.

When complete, it prints the fetched command, sleeps for 60,000 milliseconds (or one minute) and then returns.


## Lab 06-03

This example builds on the first two, but after printing the parsed command, it enters `sub_401130`. This appears to get its current filename from `argv` to populate `lpExistingFileName`. Based on the command provided at `cc.htm`, it uses a jump table to determine whether to create the Temp directory, copy itself to `C:\Temp\cc.exe`, delete `C:\Temp\cc.exe`, set `C:\Temp\cc.exe` to autorun via a Registry key, or sleep for a minute.

However, it does not appear to loop, so it can only do one of those things per execution: not very efficient!

Host-based indicators:
* Registry
  * Software\Microsoft\Windows\CurrentVersion\Run\Malware
* Files
  * C:\Temp\cc.exe


## Lab 06-04

And here is the loop: this time we have a for loop in main that iterates 0x5A0 times (for a potential total of 1440 minutes, or 24 hours), checking for a command, sleeping for 60 seconds, and then repeating.

When it checks for a command, it now changes its user agent from "Internet Explorer 7.50" to "Internet Explorer 7.50/pma1" (where 1 is the number of the current iteration). This enables the server to send a different command for each request, creating the temp file, moving the file, and so on. This user agent can be added to our network-based indicators list.

The malware's purpose is to install itself, run on startup, and delete itself on command.


# Wrap-up

> The function calls the subroutine at 0x40105F in two locations, but if we dive into that function, we will quickly get lost in a rabbit hole. This function is `printf`.

Thanks for warning me in the answer key, after I've already spent two hours too many trying to decipher this function!

I jest, of course; trying to decipher assembly code is still valuable, because when I came up out of the rabbit hole, analyzing the rest of the malware seemed trivial. Pattern recognition comes from experience, and I feel much more confident about recognizing `printf` in the future.

The rest of my analyses were accurate, though I note that the detailed solutions begin with a basic static and dynamic analysis to help gather some initial clues about the malware's behavior. This will be more important for more complex malware samples.