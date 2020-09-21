---
layout:     post
title:      "Screeps: The Game Plan"
date:       2020-09-21 14:00:00
author:     Jon Winsley
comments:   true
summary:    Diving into the deep end and implementing a flexible task manager in Screeps
categories: screeps
---

[Screeps](https://screeps.com) is an MMORTS (massively multiplayer online real-time strategy game) with a unique twist: instead of controlling your units directly, you write code in Javascript to build and manage them. Your available CPU is limited, so you have to write an AI that is both powerful and efficient.

# First Steps

I began by playing through the tutorial and improving the sample code, until I reached RCL (room control level) 4. This gave me enough experience to draw some patterns. In the rest of the article, I'll assume you're familiar with the terminology from either the tutorial or the game documentation.

## Immediate Objectives

I decided to focus on economic growth before defense. So, at the initial stage, the main objective is **Upgrading the Room Controller**. This unlocks additional Structures (especially Containers and Extensions) that will be useful for improving energy throughput, and it's also representative of the surplus energy our production process is generating.

In order to maximize that surplus, we need to **Maximize our Inputs**. There are a fixed number of Sources in a room, and they resupply at a fixed interval. If we are pulling 10 Energy/tick out of each Source, we've maximized our resource usage. (We'll tackle Minerals later.)

Once our Sources are fully tapped, we can optimize the transfer of energy from the Sources to the Controller by **Building Infrastructure.** This includes Roads (to increase throughput), Extensions (to increase minion effectiveness), and Containers (to enable specialization).

## Inputs and Outputs

Our main objective is upgrading the room controller, so we want to maximize our output (energy to the room controller). The first step here is maximizing our inputs. As noted above, 10 Energy/tick will exactly match the Source's maximum output rate. This is not too difficult, and can be met with a single minion with 5 WORK parts, starting at RCL 2.

The room controller has no upgrade cap until RCL 8, which is far enough away that we can ignore that for now.

So the bottleneck will be infrastructure: moving energy from the sources to the controller.

## Infrastructure

At an early level, this might be a simple minion that collects energy, moves to the controller, and deposits it. We'll have energy costs in creating that minion initially, and time costs in the minion's movement from the source to the controller and back. We'll have additional time costs to resupply the Spawn with enough energy to create more minions.

That time cost adds up to "time not spent harvesting energy," which is source energy wasted. Scaling up by adding additional minions is expensive, but there are other ways to reduce the time cost.

The simplest is adding Roads. Roads reduce the amount of time taken in transit (significantly, in the case of swamps).

The next logical step is setting up a container network. At RCL 2, we can create a single dedicated Miner minion with 5x WORK and 1x MOVE parts. This Miner can harvest a Source at its maximum rate, and, if it is sitting on a Container, will automatically drop its harvested energy in the container. Then a dedicated Hauler minion with CARRY and MOVE parts can collect the energy from the container and move it elsewhere. A stationary Miner and a mobile Hauler are more efficient working together than two mobile Miners.

Maintaining this infrastructure involves the initial energy cost of construction, and then an ongoing cost of repairs.

## Summary

So we have our primary Source; a primary Sink (the controller); and secondary Sinks (minions and infrastructure).

# Managing the Pipeline

There are any number of ways to attack this problem. The tutorial effectively brute-forces it, creating a spawn queue (to generate a certain number of minions) and assigning them simple behaviors that ensure that miners do mining, builders do building, etc. This reaches its limits fairly quickly, as the minions that you want to spawn will vary depending on on your room control level, available energy, and other situational factors.

My goal is to create an entirely autonomous AI that plans and constructs its own room, eventually expanding into other rooms, without direct intervention or guidance from me. So, I scrapped most of the tutorial code and settled on the following rough framework:

* **Architects** study the room and decide the best layouts for infrastructure. These may be expensive processes, but should only rarely need to be run.
* **Managers** monitor important resources and create Tasks if they discover a need (e.g., if the spawn is low on energy).
* **Supervisors** delegate priority requests to available minions.
* **Analysts** collate game data, cache it, and provide it to Architects or Managers with a goal of minimizing duplicate calculations.

These are still in flux as I refactor and adjust to new issues that arise, but this is a helpful way to separate different kinds of logic.

## Architects

The Source Architect scouts Sources and designates one mining site per source.

The Controller Architect scouts the Controller and designates one upgrade depot.

In the near future, I plan to add an Infrastructure Architect to lay out and prioritize roads as well.

## Managers

The Source Manager will request a dedicated miner and a container for each mining site mapped by the Source Architect.

The Controller Manager will request a dedicated upgrader and a container for the Controller. It will also issue a standing low-priority request for upgrades from idle minions.

The Logistics Manager will monitor levels on all containers, spawns, and extensions, and will request energy for non-Source containers/spawns/extensions when they are running low.

The Builder Manager will issue requests to build construction sites or repair structures that are decaying.

## Supervisors

The Spawn Supervisor will handle requests for minions. Given a particular class of minion, it determines the largest feasible size based on available energy, and then assigns the minion to a Spawn.

The Task Supervisor will handle all other requests. Given a particular Task (Transfer Energy, Repair Site, etc.), it looks at available minions and determines the most efficient way to distribute the open requests among the available minions. (This is pretty involved in its own right, so we'll dig into this in more detail next.)

## Analysts

I have a handful of different Analysts to collect data from different domains, such as the Map, Sources, etc. These are memoized, so they will cache the results of the request for the current game tick (for variable things like container levels, minion positions, etc.) or indefinitely (for static things like source positions).

These Analysts exist to reduce calculations for things that are checked multiple times in a given tick, like the state of containers or spawns in the room. As I iterate, most of my performance improvements will be delegated to Analysts.

# Conclusion

The above is a current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

I've gotten some inspiration from [Ben Bartlett's series](https://bencbartlett.wordpress.com/category/screeps/) on his Overmind AI, especially the Hauling post, but up to this point have not put a lot of effort into studying other Screeps AIs. That will change!

In the next installment, I'll discuss the Task Supervisor system, as there is a good deal of convolution there that needs explaining.