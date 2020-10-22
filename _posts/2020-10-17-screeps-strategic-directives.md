---
layout:     post
title:      "Screeps #12: Strategic Directives - World State"
date:       2020-10-21 22:50:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Making Bigger Decisions

The framework we've been building so far has been focused on decisions I've made, about where to remote mine, or when to defend or attack. It's time to start delegating those decisions to the Grey Company itself.

![The Grey Company neighborhood](/assets/screeps-neighborhood.png)

In Shard3 we do not have a lot of uncontested space. I am currently managing two remote territories, which are regularly encroached upon by Invader cores. Another player tried to set up a colony in one of my territories, which I rebuffed (eventually) by implementing Guards. 

But looking beyond the immediately adjacent territories, I am now at GCL2, so I need to begin scouting sites for a second Office. Or rather, the Grey Company needs to do so: and, once we have settled on a likely spot, it needs to be able to pick remote mining sites and defend them.

Before diving into this analysis, I took a break and read through ["Artificial Intelligence for Games"](https://www.amazon.com/Artificial-Intelligence-Games-Ian-Millington/dp/0123747317) (henceforth AIfG) by Millington and Funge. Not all of the content is relevant for Screeps AI, and some of it we'll revisit down the road when we're ready for more complex combat AI. But I pulled out a few key takeaways for our current state of development.

## Managing World State

Currently, world state is mostly managed by Boardroom Analysts. These function largely as Polling Stations in AIfG: any subsystem that wants information about the world state queries an Analyst, and the Analyst computes the response once per tick (usually) and remembers it for future queries with the same parameters. Some aspects of world state are instead handled at the Office layer (territory intelligence).

Let's mesh this into a more cohesive whole.

To begin with, we can identify a few layers of data:

* The raw world state (anything we pull from the game APIs): terrain, minion locations, structures, controller level
* Computed world state (anything we add to the game data): influence levels, territory intents, Franchise locations
* Selectors (meaningful groups of world state date): Salesman minions, sources in safe territories, all of my construction sites

Some of this data does not need to be refreshed at all: terrain data is constant, and will never change. Some needs to be refreshed only occasionally: if a controller is blocked, it does not need to be checked until the blocked status ends. Structures are relatively permanent, accounting for normal repairs, and only need to be re-checked when something is built or destroyed. Other data needs to be refreshed regularly: if we don't pay attention to hostile minions, they are liable to do a lot of damage.

We cannot cache game objects themselves, as they are recreated in each tick. A Creep from the previous tick is not the same as the Creep from this tick. But we cannot always rely on IDs either: we should remember when we have a Container in a room without vision.

The same is true of computed world state: franchise locations don't need to be recalculated, but influence levels and territory intents will change periodically.

The Selectors themselves can cache data only as long as their source data has not been recalculated.

So, let's remodel our Analysts to create a world state that accommodates these needs.

## Decision Making Processes

My initial foray into creep action management was an ambitious, if poorly implemented, Goal-Oriented Action Planning (GOAP) algorithm. Given a goal (transfer 50 energy to an extension) it looked for candidates to fulfill that goal. If no creeps had 50 energy, it looked for creeps that could get 50 energy. If a creep had work parts, it could get energy by mining; if it only had carry parts, it could go to a storage and withdraw the energy.

In practice, this ended up being severely limited because creeps could only carry out a single goal at a given time. When 20 extensions needed to be filled, there was no way to plot a route for a single Carrier with 400 capacity. It was also a needless complication for simple Salesmen whose only role was to go to a source and sit there and harvest indefinitely.

Our latest iteration separated logistics task management out into its own specialized module. Instead of trying to be generic, it takes one request and sets up an initial Route from the hauler's current location to a LogisticsSource and then to that request. If the Route has any capacity left over, it adds other nearby requests to the list until full. Other "ordinary" tasks such as building or upgrading were handled by simpler Tasks, which were just implemented as state machines - get energy, then go to work site, then do work.

As our overall logic gets more complex, we'll need to make these hierarchies more distinct and flexible, so we can deal with broader strategies as collections of actions, and can interrupt or resume tasks as appropriate. AIfG offers a few patterns for dealing with this, which we'll return to in the next article.

# Next Up...

I began diving into rewriting our world state and the article kept getting longer. I'll go ahead and make that design the subject of its own post, and just cut this one short. Something to look forward to: I am working on splitting out the world state into a generic library that can handle caching fields for game objects or custom data, on the heap or in Memory, in such a way that you can import it into your own codebase. We'll see if it turns out as planned!