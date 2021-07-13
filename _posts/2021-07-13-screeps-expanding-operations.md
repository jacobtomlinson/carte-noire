---
layout:     post
title:      "Screeps #19: Expanding Operations"
date:       2021-07-13 17:45:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# A Quick Recap

Nineteen posts in! This has gone a lot longer than I expected when I started almost a year ago. And we still have a long way yet to go - we haven't even touched terminals, labs, power, or advanced combat, among other things. But so far, I've collected some important lessons (and mistakes). Let's run through them briefly.

1. Data is important. Whether you log to the console, write to Grafana, or display dashboards with screeps-viz, insight into what your code is doing is invaluable for debugging and prioritizing improvements.
2. Reuse code as much as possible. Break out common snippets (like telling a creep to get energy) into clearly-named functions. If you have to fix an issue, you can do it in one place instead of ten (more often than not).
3. Understand game AI patterns. They exist to make your development easier. For one example, check out ["Artificial Intelligence for Games"](https://www.amazon.com/Artificial-Intelligence-Games-Ian-Millington/dp/0123747317).
4. Don't overuse classes. I defaulted to classes for my Managers and Analysts, in order to implement lifecycle functions, but let them grow out of control, resulting in a lot of unnecessary boilerplate elsewhere in my code.

Specific to building a reliable energy pipeline in Screeps:

1. Creeps with specific roles are more efficient than general-purpose creeps, even at RCL1.
2. Try to predict rather than react, especially when deciding minions to spawn.
3. Have some kind of room planning, even if it's just a basic stamp.
4. You should be able to hit RCL 3 + tower before your initial safemode runs out.
5. Hauling energy from sources to a central distribution point is more efficient than hauling from sources to fulfill requests directly.

Now, let's get down to the task at hand.

# Claiming a New Room

It is time to expand! We are at GCL3 on the MMO server and our private server test scenarios are easily reaching GCL2. We need to begin acquiring more rooms. Let's break this into a few steps.

First, we need to evaluate potential sites. We want to colonize two-source rooms with few swamps and where we can fit a complete room plan. If we're doing remote mining eventually, we'll want to plan ahead for that and make sure there are good remote rooms nearby.

Second, we need to initialize the new Office. We'll send a Lawyer to claim the controller. 

Finally, the Office will need help to get started - at least an Engineer to build the Spawn and a Paralegal to sustain the controller. We'll need some way to request these minions from another Office. Once the spawn is up and running, the Office can become self-sustaining.

## Territory Intelligence

Currently we are sending an Intern out to scout nearby territories. Our WorldState models are caching some of the relevant details even when we don't have vision, so this gets us all the raw information we need. We'll start with a simple formula to set our intention for each territory.

```typescript
if (!controller) {
    return TerritoryIntent.IGNORE;
}
if (!controller.my && controller.owner?.username) {
    return TerritoryIntent.AVOID;
} else if (roomPlan) {
    return TerritoryIntent.ACQUIRE;
} else if (sources.length === 2) {
    return TerritoryIntent.EXPLOIT;
} else {
    return TerritoryIntent.IGNORE;
}
```

`EXPLOIT` will be reserved for future remote mining efforts. `ACQUIRE` is what we're interested in here. If we've scouted the room and determined a viable room plan (which includes things like checking for two sources, swampiness, etc.) then it's a candidate for expansion.

## Initializing the Office

We'll create a new `Acquire` request that will be handled by an office's LegalManager. The office will spawn a Lawyer, dispatch it to the target controller, and attempt to reserve it. Once reserved, a new Office will be instantiated. Thanks to the Behavior abstractions we previously implemented, this was simple to add.

Slightly more complex is the initial bootstrapping required to build the first spawn. This requires resources from the parent office, but we don't want to disrupt the work we've put into stabilizing the energy pipeline. So, Build requests can now harvest energy from Sources as well as withdrawing from a logistics store. 

Tests in my private server went surprisingly well. I rearchitected a few things to make development easier, but there were only a couple multi-room bugs. When I pushed the code up to MMO, I ran into a couple snags. First, there was only one room available that met our criteria, at the very edge of a Lawyer's range. It had some leftover walls blocking some of our planned room sites, so I added some code to destroy or dismantle structures that are impeding planned structures.

Second was thmsn:

![thmsn's minions on the attack](/assets/screeps-expanding-operations-1.png)

thmsn's automated defenses apparently don't want a friendly neighborhood office of the Grey Company. It's much too far to contest the room, so we need to concede our colonization attempt. We don't want to bail on a room at the first sign of aggression, of course, so let's set some criteria. When our minions are attacked (by a non-Invader character):

1. If this is our only room, Defend it.
2. If we have a Spawn in this room, Defend it.
3. Otherwise, concede: unclaim the controller and Avoid the room for some length of time (we'll say 100,000 ticks for now).

Now we have a crossroads. Where we're spawned in currently, there are no other available rooms that meet our criteria. We can either respawn somewhere else... or start implementing combat code to clear some space. 