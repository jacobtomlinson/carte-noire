---
layout:     post
title:      My Adventure with a Ruby Update
date:       2015-10-22 19:44:18
author:     Yury Voloshin
summary:    What I learned on a long and winding road to a Ruby version update
categories: Ruby
comments: true
tags:
 - Ruby versioning
---
> Only a fool learns from his own mistakes. The wise man learns from the mistakes of others.

	- Otto Von Bismarck
	


I am writing this post in the hope that those of us who are starting out with Ruby and Rails will follow the [Iron Chancellor's](https://en.wikiquote.org/wiki/Otto_von_Bismarck) advice and learn from my mistakes.

A few days ago I made my first [open source contribution](https://github.com/NYCrb/cfp-app/pull/7) (yay!). The contribution was for an app used by the organizers of [NYC.rb](http://www.meetup.com/NYC-rb) meetup group to schedule talks at meetups. The issue was relatively small. I added a button that the organizer can use to delete a talk proposal. It didn't go as smoothly as I would've liked, and here's why. 

After I cloned the app on my machine and tried to run it, I got an error message "<code>rbenv: version `2.2.3' is not installed</code>". This was confusing because I didn't know what "rbenv" is, much less anything about a particular version of it. After a google search, I knew this meant that the app I was trying to run required a particular version of Ruby, which I didn't have on my machine. Indeed, a look at the app's repository showed that one of the commits was labeled "updated to Ruby 2.2.3", and a check of the Ruby version on my machine (using "ruby -v") showed version 2.0.0p353. 

But, I still didn't know what "rbenv" is. More searching on rbenv brought me to the [rbenv github page](https://github.com/sstephenson/rbenv). Turns out rbenv is a Ruby version manager that helps to specify Ruby versions in development and in production. Under "Installing Ruby Versions", I found a simple enough command that looked like it would  take care of my problem: "<code>rbenv install 2.2.3</code>". Upon running it, the result was disappointing: 

<code>
ruby-build: definition not found: 2.2.3
</code>

<code>
The following versions contain `2.2.3' in the name: rbx-2.2.3
</code>

<code>
See all available versions with `rbenv install --list'.
</code>

I did what the message suggested and ran "<code>rbenv install –list</code>". This showed a list of Ruby versions that ended at version 1.9. But what about 2.2.3? Could "rbx-2.2.3" be the version I need? I knew that "rbx" stands for [Rubinius](https://en.wikipedia.org/wiki/Rubinius), which is not exactly Ruby, but I figured, it might be close enough, and decided to install it by running "<code>rbenv install rbx-2.2.3</code>". This gave me an encouraging message "<code>Installing Rubinius 2.2.3...</code>" and started an installation process. Then, after about 20 minutes of waiting, I got
<code>
BUILD FAILED (Ubuntu 12.04 using ruby-build 20141225-1-g45b75ed)
</code>

This was not good. Clearly, I was doing something wrong. More searching led me to [instructions](https://gorails.com/setup/ubuntu/13.04) on how to install Ruby in three different ways. I could use either rbenv, rvm, or download it from source. I already knew about rbenv. [rvm](https:rvm.io), as it turns out, is a Ruby version manager that's an alternative to rbenv. I knew that I already have rbenv on my machine, but could it be that there is a problem with rbenv? Re-instaling rbenv can't hurt, can it?  

At this point, I went ahead and followed instructions for installing rbenv with Ruby 2.2.3. This time, the installation process started with a message "Installing Ruby 2.2.3...", which was even more encouraging. But, after another 20 minutes, I got 
<code>
BUILD FAILED (Ubuntu 12.04 using ruby-build 20141225-1-g45b75ed)
</code>

Not again! Now what? Then I thought, if rbenv doesn't work, I could try rvm. After following the intructions for rvm and waiting another 20 minutes, I got another dreaded BUILD FAILED. What's going on here?

It was time for more googling. I used the <code>BUILD FAILED...</code> error message as the search term and the first few results were posts from the Issues section of [rbenv github page](https://github.com/sstephenson/rbenv). None of them were directly relevant to my problem. But, that led me back to the Readme file on rbenv github page. There, I noticed a little section on "Upgrading". Maybe upgrading rbenv is what I need... I ran the pull command and it pulled in a long list of rbenv files! Could this make a difference? As the instructions in Readme suggest, I ran "rbenv install 2.2.3" one more time. This time, there was no error and the installation process started. After another 20 minutes, I saw "Ruby 2.2.3 installed". It finally worked! This made me feel like the king of the world. Now I was able to start the Rails server and start coding. 

At the time, this was a frustrating experience. But in retrospect, I'm glad it happened. It taught me three important lessons. First, now I know much more about Ruby version management than I did before this snafu. Second, I reinforced in my mind the idea that, if a piece of software doesn't behave as expected, the first thing you should do is make sure you're using the latest version of the code. This is particularly true when dealing with open-source software. Third, look for help on the software's github page. (If I read through rbenv's Readme page and wiki page more carefully, then I would've noticed the instructions to update rbenv and would've saved myself some grief.) If that doesn't help, then start googling.
