---
layout:     post
title:      "Screeps #3: Pipeline Optimization"
date:       2020-09-23 15:00:00
author:     Jon Winsley
comments:   true
summary:    Teaching the AI to make strategic decisions with data
categories: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Data and Analytics, Revisited

In the last installment I talked about getting some initial analytics set up. I've made a few adjustments since then; here are the energy pipeline charts I'm currently watching:

![Screeps energy pipeline dashboard](/assets/screeps-pipeline.png)

Sources tracks the approximate energy/tick being extracted from the sources (the periodic drops to 0 are when the source replenishes itself).

Sinks tracks the approximate energy/tick being devoted to different activities, such as building, attacking, healing, repairing, and upgrading the controller. These sinks are estimates by the minions/towers performing the actions, but they are close enough for our purposes.

Source Balances tracks the total amount in the Sources and the amount in the Mine Containers. The red and blue lines are Mine Container capacity and Source capacity respectively.

Destination Balances tracks the available energy in the room and the energy in destination containers (anything other than a Mine Container), as a percentage.

## Analysis

![Current activity in my main Screeps room](/assets/W32N39.png)

Beginning with the sources: if we are fully exploiting our Sources, we should be extracting 10 energy/tick from each source, for a total of 20. We're getting close to that, averaging just a little bit under, which makes sense as there's some lag time between when a miner dies and a new one takes its place.

Note the Source level is hovering right around half capacity with a jagged sawtooth pattern: this is because the sources are replenishing at staggered ticks. If the miners were in sync, with both sources replenishing simultaneously, we'd see this metric dropping to 0 and then jumping back up to the peak again. This is interesting, but since it's roughly level, there's nothing of immediate concern here.

The Mine Storage level, however, is of interest. It's hovering right at half capacity. This is because the upper Mine is maxed out, but is getting little attention from Haulers (there is actually a pile of excess energy that won't fit in the container!). Meanwhile, the lower Mine is right where all the action is, so all the Haulers are fetching energy from there, depleting it to zero on a regular basis.

Ideally, both of these containers should be depleting to zero. Since they're not, we know we have a bottleneck somewhere down the line.

Let's look at Destination Balances. This includes Room Storage (spawns and extensions) and Containers. Any container that isn't a Mine Container is intended as a depot, perhaps for the upgraders, for focused construction work, or for a forward military base. These should be kept supplied, and should also be drawn from regularly. (You might note that the depot for the Room Controller was created and stocked halfway through this graph.)

Finally, let's look at the Sinks. We had a spike of building to set up the Controller Depot, and then upgrading picked up after the depot was established. But our total output is still averaging 11 energy/tick (compared to 20 energy/tick input).

Our Destination Balances are staying pretty full, but our Sinks are low. So we need to scale up our output: this means building more (and bigger) Upgraders.

But our goal is complete automation, so we don't want to just specify a manual limit. How can we teach the AI to monitor this pipeline and adjust accordingly?

# Autoscaling

Let's start from zero.

When we first drop a spawn - or any time before we have our Mine Containers established - the miners are pulling double duty, collecting energy and then delivering or using it. We can use Source Levels as a metric for raw input, and Sinks as a metric for raw output.

As a general rule, input should be prioritized over output. So, naively:

1. If average input levels are low, spawn more Miners.
2. If average output levels are low, spawn more Workers.

## Miners

At low levels, Miners and Workers are the same unit: `[WORK, CARRY, MOVE]`. So if we spawn enough minions to maximize input, we are also maximizing our output. They harvest, do work, and go back to the mines.

Now, these low-level minions may not actually be able to max out input. It takes 5 WORK parts to max out a Source, and many Sources don't have 5 adjacent walkable squares. So we need to calculate our max effective input.

```
// Workers are (by energy cost) 1/2 WORK, 1/4 CARRY, 1/4 MOVE
// WORK parts cost 100 energy
// So, max available minion work parts...
let minionWorkParts = Math.round((1/2) * room.energyCapacityAvailable / 100)

// Viable work parts per source
Math.max(5, (adjacentSpaces * minionWorkParts))

// Over all sources
sources.reduce((sum, source) => (sum + Math.max(5, calculateAdjacentSpaces(source) * minionWorkParts)), 0)

// Max energy output per tick
sources.reduce((sum, source) => (sum + Math.max(5, calculateAdjacentSpaces(source) * minionWorkParts)), 0) * 2
```

So, if our actual energy input is below the maximum, we need more miners. But this isn't likely to be perfect, especially with small miners. So let's set our threshold to spawn when input is below 80% of the maximum.

But we won't see a change immediately after spawning a miner: we need some time to measure its impact. We can roughly estimate what this time should be by measuring the distance between the spawn and the furthest source.

```
let distance = sources.reduce((distance, source) => (
    Math.max(distance, PathFinder.search(spawn, source).cost)
), 0)
```

Since this is an estimation, let's multiply by 1.25 to give ourselves some margin. We'll wait that many ticks, then check the average energy output again.

But what if we have no miners? We know we'll need more than one, and we shouldn't have to wait so long to find out. It's safe to say that, as a minimum, we should have enough miners to fully utilize the Sources, if they are all working at once. In reality, they'll often be off doing other jobs, but this gives us a baseline. We can adapt the formula for max input, above:

```
// Number of simultaneous miners to max all sources
sources.reduce((sum, source) => (sum + Math.max(calculateAdjacentSpaces(source), Math.ceil(5 / minionWorkParts))), 0)
```

Miners will naturally die off, so we don't need to worry too much about auto-scaling *down* the miners. This gives us a good start at least: let's test it in simulation and see how it goes. If this piece works, we'll look at auto-scaling workers, once we switch to stationary miners.

# Several hours and many bugfixes later...

I have experimentally determined something that perhaps should have been obvious.

Spawning a Pioneer (WORK/CARRY/MOVE) requires 200 energy. Each creep lives for 1500 ticks. The maximum income per tick is 10 energy per source. Assuming maximum efficiency, this means one minion per source every 20 ticks. In a one-source room, with maximum efficiency, you could sustain 75 creeps with a single spawner.

Practically speaking, the efficiency of small creeps is fairly low, especially since they are also engaged in other tasks (such as building infrastructure). In the simulation room, the creeps seemed to peak around 25% of the maximum potential income.

What this means is that all this complex math to spawn minions is pretty much moot, at least at low levels: we can just turn on the faucet and leave it on, at least until we get some basic infrastructure in place. The pipeline will limit itself.

(Don't worry, this work was not in vain: we'll be able to apply the energy pipline better at higher levels!)