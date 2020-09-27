---
layout:     post
title:      "Screeps #5: Refactoring for Remote Mining"
date:       2020-09-27 12:00:00
author:     Jon Winsley
comments:   true
summary:    Preparing to venture outside the walls of our own starting room
categories: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

![Getting ready to branch out to another room](/assets/screeps-9-27.png)

# Branching Out

Up to this point, almost all of my logic has been specific to a particular room. I'm looping through Game.rooms and having my Analysts, Managers, etc. do their work with each one. But if I'm going to start doing remote mining, we'll need to be a bit more nuanced than that.

"Remote mining" is where we send minions to a room we don't own to harvest the energy and bring it back. The goal is to increase energy input without needing to claim and build up the entire room.

So let's start by changing our mental models for organizing our empire.

## Corporate Hierarchy

We'll begin by designating the owned room as an Office. Adjoining unowned rooms will be the Office's Territory. We'll attempt to space out our Offices enough that they can each maintain a buffer of exploitable territory, but close enough that they can aid one another.

(Defending a larger swath of empire will be more difficult, but also more exciting, so we'll try this until it proves unfeasible.)

The Office will be responsible for tactical and strategic decisions within its own Territory. To build new Offices, coordinate them, and enable flow of resources and minions between them, we'll create a single Boardroom.

## Divvying up the Data

Let's map things out like this, to start with.

```
class Boardroom {
    offices: Office[];
}
class Office {
    center: RoomIntelligence;
    territory: RoomIntelligence[];
    employees: Id<Creep>[];
}
class RoomIntelligence {
    name: string;
}
```

Most of this structure will be stored on the Heap (that is, in global scope, not kept in Memory). It can be derived from the game state with a little work: all rooms with `room.controller.my === true` are Offices, all exits from an Office room point to Territories, etc. The Employees list probably will need to be maintained in memory. It's possible an Office could send a scout minion off into unowned territory, or have it visit another Office temporarily.

## Delegating Managers

Right now we have a handful of different kinds of management classes.

* Architects plan structure layouts for mining sites, controller depots, roads, and eventually everything involved with room planning.
* Analysts provide cached responses to questions, like "what sources does this room have?"
* Managers monitor different aspects of the room's state, (minion count, container or tower energy levels, etc.) and issue requests to fill needs
* Supervisors monitor the queues for task or spawn requests and delegate them accordingly

### Architects

We'll need to plan infrastructure not just for the central Office rooms, but also for the exploitable Territories. We'll at least want roads to the Sources, and eventually containers as well, to enable the hauler workflow. These will need to operate on a per-Office basis.

### Analysts

Because Analysts are intended to cache results to reduce repeat calculations, these will be best suited for a global scope. They may answer questions that pertain to a single room, or to an entire Office, or to the whole Corporation.

### Managers (and Supervisors)

Tasks such as Remote Mining may cross room boundaries, so these should operate on a per-Office basis. The Boardroom will eventually coordinate requests between Offices, but all details of task fulfillment will still be handled by the Office.

# Implementation

While we're refactoring, I'm going to shore up my lifecycle definitions. Right now I have `init`, `load`, `run`, and `cleanup` lifecycle functions inconsistently for the different types of manager classes. Let's be specific about how these will work.

* Class constructors
  * (run every global reset) Reload data from Memory
* plan
  * (every n ticks): For each Boardroom manager, review the current state and priorities, and create requests for the Offices.
  * (every tick): For each Office manager, review the current state and priorities, create requests, and assign tasks.
* run
  * (every tick): For each Office manager, execute the planned tasks
* cleanup
  * (every n ticks): For each Boardroom manager, commit any important data to Memory
  * (every tick): For each Office manager, commit any important data to Memory

The Boardroom manages broader strategic goals, so it probably doesn't need to run every tick. This should save a little CPU. The Offices can be self-sufficient enough to survive between meetings.

So our loop will look something like this:

```
global.boardroom = new Boardroom()

mainLoop() {
    if (Game.time % 50 === 0) {
        Boardroom.plan()
        Boardroom.cleanup()
    }
    Offices.forEach(office => {
        office.plan()
        office.run()
        office.cleanup()
    })
}
```

While we're at it, I want to shift the actual prioritization of different kinds of work up from the Managers to the Office level. The Managers will still be responsible for priorities within their domains (for example, the ConstructionManager will decide which construction site should be worked first) but the Office will decide the energy budget to allocate to each Manager. The Manager then does what work it can within that budget. We'll get into this in the next post.