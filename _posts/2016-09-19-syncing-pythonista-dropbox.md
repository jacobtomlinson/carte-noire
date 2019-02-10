---
layout:     post
title:      Syncing Pythonista with Dropbox
date:       2016-09-19 16:22:00
author:     Jon Winsley
summary:    Syncing Pythonista with Dropbox
categories: python
tags:
 - api
 - dropbox
 - pythonista
---

In my pursuit of more perfect Python skills, I discovered and immediately fell in love with [Pythonista](http://omz-software.com/pythonista/), an iOS IDE. (Full disclaimer: I agonized over spending $10 on it for a couple weeks, but when I took the plunge I did not regret it.)

One of the first things I had to do was find a way to sync my project files between my iPhone and my iPad. Ideally, I wanted to be able to access them from my computer as well. Dropbox was the easy answer. But it wasn't supported out of the box (ha).

The Pythonista community has provided a [few](https://gist.github.com/mlgill/8311088) [Dropbox](https://forum.omz-software.com/topic/1518/dropbox-file-picker) [sync](https://github.com/rmward/pythonista-dropbox-sync) [implementations](https://github.com/dhutchison/PythonistaScripts), all in various states of development. I picked [dhutchison's DropboxSync.py](https://github.com/dhutchison/PythonistaScripts) to start with.

To run the script, you first create an "app" in Dropbox's App Console. That gives you an App Key and an App Secret that you'll use to connect the script to your Dropbox folder. I always set these up to create an app folder in Dropbox, so as to keep from cluttering up my main Dropbox root:

![dropbox](/assets/dropbox.png)

It worked pretty well as is. Due to a bug in the Dropbox module, I had to add a shebang to run it with Python 2 instead of 3 (which was my default):

```
#!python2
# See: 
# http://www.devwithimagination.com/2014/05/11/pythonista-dropbox-sync
# http://www.devwithimagination.com/2016/06/14/pythonista-dropbox-sync-revisited/ 

import webbrowser, os
import dropbox
import hashlib
import json
...
```

It gave me SSL warnings, but was able to sync with Dropbox from my root directory. Success! I could now work on my projects from either my iPad or my iPhone.

But there was still room for improvement.

dhutchison's script used OAuth v1, which had since been outmoded in the Dropbox API by OAuth v2. I rewrote the authentication functions for OAuth v2, and coincidentally ended up with a version that works in either Python 2 or Python 3! I also tweaked it to run from any directory, as I was now working with a git repository cloned via StaSH's git utility.

Here's the [final version](https://github.com/glitchassassin/PythonistaScripts) (so far).

There's still room for future improvement: currently it syncs the entire Pythonista Documents folder, with no option to sync only a particular subfolder. It could also benefit from a UI interface. I'll work on those down the road a bit, but feel free to submit a pull request if you get there first.

Cheers!