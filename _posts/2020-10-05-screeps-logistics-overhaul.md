---
layout:     post
title:      "Screeps #8: Logistics Overhaul"
date:       2020-10-06 11:15:00
author:     Jon Winsley
comments:   true
summary:    We have collected data, and the data says we're doing it wrong.
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Logistics Recap

The reporting we've implemented following the last post has highlighted some issues with our approach. At RCL1/2, before containers or extensions, energy is getting backed up at our Franchises. This is limiting how fast we can build/repair/upgrade.

## The Issue

After branching out into Territories, I switched from swarm mining at low levels (sending lots of small minions to harvest, then build/repair/upgrade) to drop mining (filling the Franchises with enough small dedicated Salesmen to tap the source, dropping the energy on the ground for any minion to collect). Even with small (2 WORK) Salesmen, this immediately began piling up plenty of energy.

Now the problem is how to effectively distribute the energy. We have Carriers to move energy from the Franchises to destinations, but at RCL1/2 the only destination structure is our Spawn (which fills up quickly). We really need to get the energy to the Controller and to construction sites.

At higher RCLs, we'd have a dedicated container at the Controller, and perhaps near areas of significant construction; then the Engineers and Lawyers would handle the "last leg" hauling from those containers to the target. But right now, our "last leg" is the entire distance from the Franchise stockpile to the target.

## The Underlying Architecture

As detailed in the previous post on [task management](https://www.jonwinsley.com/screeps/2020/09/21/screeps-task-management/), I started out with a flexible task system that tries to fit the best creeps to the highest-priority requests. Except for dedicated Salesmen and Lawyers, which are given tasks directly by their respective Managers, all other minions are allocated tasks by the TaskManager based on a) the estimated time for them to complete the task and b) the estimated output for the task.

This is nice, in theory, because it means that if we have Engineers with no current construction work they can automatically start picking up Upgrade requests (for example). In practice, most of the benefit to this system comes from finding efficient paths for the distribution of energy.

# Separating Logistics

Our stable-marriage algorithm is most relevant for energy Carriers, who have multiple sources and multiple destinations to consider. If we consider Engineers/Lawyers/etc. to be responsible for the "last leg" only, this reduces the complexity of their task plan significantly: they need only to consider their target and the source closest to the target, not all other possible options.

This also means the TaskPlan for these non-logistics tasks can be considerably simplified to a single Task, which encompasses traveling to the nearest source and then back to the target to do work. Because the path is the same, picking the best minion is a matter of a) distance from the task and b) the minion's active parts.

Simplifying these will make development easier, and will also reduce our CPU overhead. But there's a catch: we have to figure out how to quickly set up closer temporary "sources".

## Mobile Containers

Containers take a while to build (especially with our logistical inefficiencies). But creeps are easy to build. And creeps can transfer energy to other creeps. What if we used Carriers as mobile containers?

Instead of transferring energy to a container at the end of their route, the Carrier would settle down and wait for a minion to come over. Then it could transfer energy to the minion until it was empty.

This is still less energy-efficient than a proper Container (because minions die), but may be a good interim solution until Containers can be built (or where the need isn't great enough to warrant a whole Container).

## Reworking Task Management

We could rewrite this so that Logistics is entirely separate from other kinds of tasks, but I don't think that's necessary. Instead, for now at least, I'll use the current state as the basis for the Logistics operations. Then I'll just simplify the other kinds of tasks. 

We'll remove any prerequisites such as MustHaveEnergy or MustBeAdjacent. Instead, our prerequisites will just check if the minion's parts are compatible with the task. The task action will get energy (if needed), move the minion to the target (if not already there), and do work, repeating as necessary.

## Generating Depot Requests

As I worked through these changes, my Carrier minions started setting up depots for Build requests that had not yet been assigned. This creates a severe bottleneck, of course, so we need to set up a Depot request only after the Build/Repair/Upgrade request has been assigned. We'll also check when we run the DepotTask to make sure the originating request is still being worked. If not, we'll cancel the DepotTask, and send the minion back on its merry way.

# Review

So, how did we do?

The above is only a fraction of the actual changes I made. I reworked some of my Logistics logic to make sure containers/dropped energy/etc. was being utilized properly, and I retuned the counts of minions being spawned (particularly Engineers).

Right now, the depot system works: it hauls energy to construction sites, and reduces movement for Engineers and Upgraders. It's naive, in that it doesn't know how to balance the worker's output with the depot input, but that's not a huge issue. It has markedly improved the speed of construction of the initial containers.

I really want to get my code merged back into the MMO, but there is one more significant thing to address: our Offices' remote mining operations need to avoid hostile Territories. Then I really want to get some kind of room layout implemented: that will be the subject of another post.