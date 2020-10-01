---
layout:     post
title:      "Screeps #6: Remote Mining Hurdles"
date:       2020-09-30 21:25:00
author:     Jon Winsley
comments:   true
summary:    Finding a better way to track and prioritize work as we expand into other rooms
categories: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# No Accounting for Taste

A great deal of my time fixing bugs lately has involved rebalancing priorities. How many haulers should be spawned? Do we need a standing army of builders if we have towers to handle repairs? Should we dump energy into the Room Controller, Storage, or both?

All of these priorities are currently handled by the different Managers. I'd like to centralize these prioritizations by Office instead. Managers should prioritize within their concerns - the ConstructionManager should decide which construction sites need built first - but the Office should decide how much priority to allocate to construction (and builder minions). This changes over time, and depending on the circumstances.

* At RCL1 our energy budget should be devoted roughly evenly to harvesting and upgrading.
* At RCL2 we want to shift most (all?) of our upgrading budget to construction, until we get our Mines, Upgrader Depot, and Extensions built, both at our Office and in surrounding Territories.
* At RCL2 with containers built, our harvesting budget should be relatively constant, and we can shift more into upgrading, leaving the ConstructionManager enough to keep building roads.
* At RCL3 we initially shift back, leaving a minimum budget for upgrading while we set up our new infrastructure (extensions, a tower.)
* At RCL3 with extensions and tower built, we shift back to upgrading, leaving enough in Construction for roads (if needed).
* At RCL4 we have more infrastructure (extensions, storage)

If we should lose infrastructure for some reason (hostile action?), of course, the Construction budget would need to be increased until that was remedied.

## Implementation Details

At present, the main barrier is that we don't have limits on requests. Our managers are only changing the priority, but they're filing requests each tick (in most cases) for the maximum amount needed. To control this better, we need to dictate the timing of requests, the maximum amount, and the priority.

This way, during the RCL2 pre-construction phase, we can specify that the controller should still get some energy periodically (to prevent it from downgrading), but we don't need to dedicate a whole minion to the task.

For now, we'll specify the following Modes for a Manager:

* OFFLINE
* MINIMAL
* NORMAL
* PRIORITY

We'll let each Manager determine the specifics of what this means.

# Three Days Later...

Expanding beyond my initial room has proven to be a more significant hurdle than expected. A few of the issues I ran into:

* I had started caching paths for TravelTasks in Memory with `RoomPosition.findPathTo`. These paths end abruptly at the end of the room, so I switched to PathFinder instead for inter-room travel.
* While I was at it, I shifted all of my architecture away from loading Memory each tick, and instead am only loading from Memory after a code push or global reset. From then on data is saved to Memory, but read from the heap.
* When my creeps aren't in a room, I lose visibility to Sources, ConstructionSites, and unowned structures like Containers. I had to start caching these as well.
* There is no built-in function to calculate range between two RoomPositions in different rooms.

This led to some deeper refactoring. I created "cached" classes for important things like sources, construction sites, and containers, so the Office can keep track of them even when there is no visibility. These are generally managed by Analysts, which are scoped to the Boardroom level, so results are shared between Offices (where appropriate).

Not everything needs to be cached: owned structures and depots grant sight, so we only need to store their IDs and reconstitute them each tick.

I still had a few task-related functions that expected an actual game object: harvesting, for example, expected a Source. Instead I am passing the cached room position of the source, so the minion can get there, and then looking for the source in that square when the minion is in position.

I have not completely solved the range-between-rooms question. For now, I'm just rounding to 50 per room, which is close enough to test with. I'll implement some proper geometry calculations eventually.

As of today, I think I've worked through most of the underlying architecture changes. On a private server, my minions are able to quickly start multiplying and spreading to adjacent rooms to harvest. Next I plan to start tuning and testing my expansion priorities, but for that I will need some better visibility into the AI's state and decision making.

I already have some rudimentary reports in the console for task management and a few other subsystems, but I want to improve this and start leveraging RoomVisuals (and perhaps the new MapVisuals) to make it easier to monitor what exactly is going on. We'll tackle that in the next post.

# The Theme So Far

I started laying out the "theme" of my AI in the last post. Let's expand on that, just for fun.

* The Grey Company is a sprawling corporation with global aspirations.
* The Boardroom oversees individual Offices (claimed rooms). Eventually these Offices will be named for world capitals (the London office, e.g.).
* Each Office manages its surrounding Territories, setting up Franchises at the Sources.
* Salesmen man the Franchises and collect income as Energy. 
* Lawyers lay claim to Controllers to carve out Territories.
* Security, of course, defends the Office and its Territories
* Distributors haul energy from Franchises
* Engineers build and repair structures

We'll fill this out a little more as we go.
