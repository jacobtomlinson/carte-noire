---
layout:     post
title:      Lackey - GUI Automation with Image Recognition
date:       2016-09-19 15:42:00
author:     Jon Winsley
summary:    I built a Python library for desktop automation with fuzzy image matching.
categories: automation python
tags:
 - automation
 - lackey
 - pure python
 - sikuli
---

In my line of work, I've found scripting to be an absolute lifesaver. I am far more efficient (and accurate) when I can have the computer do my manual grunt work for me. Some of this involves GUI automation.

I ran into an issue with one of our business applications, which is published via Citrix. The "traditional" kind of GUI automation using accessibility hooks doesn't work for published applications (since they're actually running on a remote Citrix server). I needed a workaround that could recognize windows and regions of the screen. My search led me to [SikuliX](http://sikulix.com/).

I liked it right away because it used Python (well, Jython), which I had already been working with. The Sikuli IDE made it trivial to quickly write scripts and capture images, and I soon had a stockpile of scripts to update accesses, copy data from our live system into our test system, etc.

Eventually I had enough scripts that I wanted to run them via remote desktop on a different machine, so I could keep using my desktop computer for other tasks. However, because of our enterprise policies, the remote server doesn't have Java installed. I searched for a way to run Sikuli scripts with pure Python, but found nothing at the time.

So, I decided to build it.

[Lackey](https://github.com/glitchassassin/lackey) is the result of that endeavor.

Existing Sikuli scripts can be run with minimal modification just by importing the Sikuli shim at the top of the script:

```
from sikuli import *
```

Since Sikuli script overrides some Python native functions (like `input()`), you can also just import Lackey and call the automation functions directly:

```
import lackey

# Sets r to the region of the default screen
r = lackey.Screen().getRegion()

# Clicks on the location of "start_button.png" in the default screen
r.click("start_button.png")

# Types "cmd.exe" and then the ENTER key to run it:
r.type("cmd.exe{ENTER}")
```

Lackey is currently in an alpha state. It's built to be cross-platform compatible, but the only platform it currently runs on is Windows (only because that's all I run it on). I'll eventually expand it to run on Linux as well. Other "future features" to get up to speed with Sikuli will include OCR, event handling, and speed optimizations on the image search.

If you'd like to try it out, [check out the repo](https://github.com/glitchassassin/lackey) for installation instructions. Lackey is published via pip, so it's easy to set up and get started with. If you run into any bugs, file an issue on GitHub and I'll get it fixed. If you'd like to contribute, feel free to submit a pull request.

Cheers!