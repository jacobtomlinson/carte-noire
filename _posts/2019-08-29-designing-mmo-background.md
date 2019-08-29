---
layout:     post
title:      Designing an MMO - Background
date:       2019-08-29 16:00:00
author:     Jon Winsley
comments:   true
summary:    In which we dive into the maddeningly complex endeavor of building an MMO from scratch (kinda).
categories: gamedev
tags:
 - game development
 - software design
---

Everyone wants to hit it big. Come up with a killer game idea, create a viral hit, and rake in the cash! If that's what you're after, I don't know how much help this series will be, but you're welcome to stick around. We're going to explore the technical details of designing and implementing a massively multiplayer game.

## Background

So let's talk briefly about what we're bringing to the table for this game design. Skillset is important because it dictates the scope of what we can accomplish solo. Cultural influences give us a reference for the "feel" we're going for.

They always say "never build an MMO as your first game". I'm going to break that rule... well, bend it, at least. I did write [a simple puzzle game](https://glitchassassin.github.io/crossed-lines/) a few years ago. The majority of my dev experience has been in building tools and user interfaces, so we're going to leverage that pretty heavily. I am not much of an artist, so this game won't be super graphics-heavy.

I've had a fascination with computer security since reading about the wild exploits of early hackers, from MIT to Kevin Mitnick to "Hackers" (the movie). I loved playing Uplink for the adrenaline of bypassing defenses before your target could complete its trace. I loved Lego's Nightfall Incident for the cool hacker/spy thriller setting. And, separately, I really like the paranoia of EVE Online. You're all alone in a big world, and anyone could be out to get you. You can clan up with other players for protection - but can you trust them not to screw you over? 

## Big Picture Planning

Uplink was a cult classic in its day, and I've seen a couple attempts at multiplayer versions since. This suggests there's enough interest that a well-executed game might just be able to secure a niche.

Our Core Gameplay Loop will resemble both Uplink and the Nightfall Incident:

1. Use resources to acquire software
2. Use software to find and hack targets
3. Gather resources from targets
4. (see step 1)

To achieve the paranoid cooperation and competition I like in EVE Online, we'll need a persistent multiplayer experience (an MMO, as opposed to multiplayer-lobby games). We'll also need the following:

1. Player-created clans
2. Player- or clan-controlled resources (that can be stolen)
3. Advantages to teaming up that improve the Core Gameplay Loop

These are some very broad brushstrokes, and I'm not really elaborating on my reasoning here. That will come later; right now, we just want to get a sense of the overall direction of the project.

## Expectations

This is (at this point) a one-man project. A hobby, at that. I have a family to take care of, and my day job also involves development. I'll take breaks from time to time to avoid burning myself out, or to get inspiration, or just because life gets busy.

I don't really expect this to ever turn into a full-time job. I've never found a monetization scheme I really like (mostly because I like playing games, but don't like spending money). So my goal right now is just to find a way for this project to be self-sustaining, paying for its own server costs, while I work on it nights and weekends because I enjoy it.

Long story short, I'm tackling this at my own pace. Feel free to tag along on the journey, and let's hope we both learn something along the way.

In the next post, I'll start discussing more specifics of the software architecture underlying the game. We have a lot to work through before we get to the actual gameplay mechanics!
