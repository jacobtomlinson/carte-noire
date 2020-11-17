---
layout:     post
title:      "Screeps #15: Room Planning"
date:       2020-11-11 14:55:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Time to Expand

I have been working with a single room in MMO since I started (almost two months ago now). I've gotten to RCL 7 and GCL 3, and I think it's about time to expand. I've been putting it off until the Grey Company can handle that on its own. Now that we're at RCL7 and have a reasonable understanding of the needs of our base, we can start base planning effectively.

## Objectives

On shard3, my primary goals are, in order:

1. CPU Efficiency
2. Energy Efficiency
3. Defensibility

Because shard3 is CPU-restricted, efficiency is especially important. I'm spending a lot of CPU on move intents right now, so limiting movement is valuable. This means cutting out remote mining, which in turn means we won't have as much energy to work with. Defensibility is less important than on some shards, because hostilities require CPU, but we cannot forget it completely.

# General Layout

We'll aim to break up the room into modules. We'll construct Franchises at each source, and a Headquarters at the Controller:

![Room layout](/assets/screeps-room-planning-1.png)

The Franchises have a Spawn, a Link, and a Container. The Headquarters also has a Spawn and a Link, a Container for the dedicated upgrader minion, the Terminal and Storage, and all six towers. (Since we don't have lab or factory code yet, we'll put off adding those to our room plan.)

## Layout Rules

We'll assign these positions according to the following rules:

**Franchises**

1. The Franchise containers will be at the first position of the path between the Source and the Controller.
2. The Franchise link and spawn will be adjacent to the container, but not on the path to the Controller.
3. The first spawn placed in a room will be the Franchise spawn closest to the Controller.

**Headquarters**

1. The Headquarters is placed as a block.
2. The Controller container must be within 3 squares of the Controller.
3. There should be a path from both of the spawn squares to both Franchises.
4. The Headquarters block may be rotated, if necessary, to fit.

**Extensions**

1. Extensions will be flood-filled evenly around the Headquarters entrance, staggered so there is space to move between them.
2. Eventually, extensions will also be placed at Franchises, to allow for more efficient filling as well as "Snowgoose links".

## Some Explanations

The Salesman minions at the Franchises will, after RCL3, harvest and then deposit energy in the Extensions, the Spawn, and the Link, in that order. Prior to RCL3, we'll rely on our existing pattern of dedicated Carrier minions to move dropped/container Energy into those structures.

The ramparts on the diagram will be the locations of the dedicated Upgrader minion (on the left) and dedicated Carrier minions (top and bottom) who shuffle energy around within the Headquarters. 

## Implementation Details

The Architects will generate the plan for each block (Franchise #1 & #2, Headquarters) once, and then convert it to a minimal representation which can be cached in Memory. Then, every `n` ticks, it will check the current status. If a structure should be built at the current RCL, but isn't (and has no pending request), it will submit a BuildRequest; if the structure exists but needs repairs, it will submit a RepairRequest.

To test this process, I'll use [this RoomVisual extension](https://github.com/screepers/RoomVisual) from the Screepers organization (which has a lot of other helpful resources as well).

Previously, Architects were an Office function; however, if we want to use them to plan expansion (avoiding rooms that cannot accommodate our layout), we'll need to run them on non-Office rooms as well. We'll make these a special case of a Boardroom Analyst instead so we can analyze any room.

![Scouting the neighborhood has begun](/assets/screeps-room-planning-2.png)

Finally, scouting: before we can plan a room, we need to know what it looks like. Because we have a centralized WorldState, all we need to do is send a minion to Explore each of the surrounding rooms, and then we'll have everything we need to generate a RoomPlan.

# Conclusion

![A successfully planned room](/assets/screeps-room-planning-3.png)

Aside from the systems we haven't begun to implement - labs, factories, extractors, power, etc. - the only thing we're currently missing is ramparts. I think we'll go ahead and put those off, too. I'd like to get some more rooms up and running first: we can extend our RoomArchitect later.

So, next up, let's fire up the private server again and start building from scratch using the RoomArchitect. Then we'll start planning expansion caravans!