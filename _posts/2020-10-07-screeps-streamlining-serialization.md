---
layout:     post
title:      "Screeps #9: Streamlining Serialization"
date:       2020-10-07 08:00:00
author:     Jon Winsley
comments:   true
summary:    Deploying our private server-tested code to MMO immediately broke our CPU bucket. Time for the CPU Clinic!
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# I Need More Power

After finishing the Boardroom implementation, I pushed the code up to my MMO branch, and almost immediately my CPU bucket hit zero. Time to panic: my testing was with the private server's default limit of 100 CPU, and I'm on shard3 which has a limit of 20 CPU. (These aren't exactly equal units, depending on the performance of the private server, but you get the point.)

I threw together a hasty profiling function to measure the CPU used between invocations:

```
let lastCPU = 0;
global.reportCPU = (message: string) => {
  console.log(message, Game.cpu.getUsed() - lastCPU);
  lastCPU = Game.cpu.getUsed();
}

global.reportCPU('Loading Boardroom');
global.boardroom = new Boardroom();
global.reportCPU('Boardroom Loaded');
```

After sprinkling this reportCPU code around, the bulk of my CPU usage (by a significant margin) is coming from serialization, to write things to memory. Let's see what we can do to fix this.

## Current State

I've been using [class-transformer](https://github.com/typestack/class-transformer) to convert classes into JSON and then reconstitute them as classes of the same type. This is helpful because I can store (for example) RoomPosition references in my classes, and when they are reconstituted from memory, the position is also reconstituted as a RoomPosition (with all the associated instance methods).

I am deserializing this data from Memory only after a global reset, but serializing it into Memory every tick, to save my place. There are several places where I do this - the Analysts maintain caches of data, TaskManager stores its open tasks and requests, etc.

Speaking of TaskManager, that's one of the really heavy hitters:

```
cleanup() {
    if (!Memory.tasks[this.office.name]) Memory.tasks[this.office.name] = {
        tasks: '',
        requests: ''
    }

    // Write tasks to memory
    Memory.tasks[this.office.name].tasks = serialize(this.tasks
        .filter(task => !task.completed || Game.time > task.created + 500))

    // Write requests to memory
    let serialized: RequestsMap<string> = {};

    for (let reqType in this.requests) {
        serialized[reqType] = {};
        for (let reqSource in this.requests[reqType]) {
            if (this.requests[reqType][reqSource].completed ||
                !this.requests[reqType][reqSource].task?.valid() ||
                Game.time > this.requests[reqType][reqSource].created + 500) {
                // Completed, no longer valid, or timed out
                delete this.requests[reqType][reqSource]
            } else {
                // Clean up linked tasks
                this.requests[reqType][reqSource].assignedTasks = this.requests[reqType][reqSource].assignedTasks.filter(t => !t.completed);
                serialized[reqType][reqSource] = serialize(this.requests[reqType][reqSource])
            }
        }
    }

    Memory.tasks[this.office.name].requests = JSON.stringify(serialized);
}
```

Each tick, we are reserializing all of the tasks and requests. Those `serialize()` calls take time.

# Improving Performance

The first question we should ask ourselves is *do we need to be serializing this at all?* Global resets don't happen often, so can we store it in the Heap and just rebuild it after a reset?

I think the answer for TaskManager and HRManager is yes. These tasks are supposed to be ephemeral, disappearing after they are completed, and the Managers that submit requests will resubmit their requests in the same tick (in most cases). There will be some recalculation in the tick after global reset, to reassign all the new requests, but that will be significantly less than the overhead of serializing the requests.

After eliminating TaskManager and HRManager, the next significant cleanup routines belong to StatisticsAnalyst, FacilitiesAnalyst, and SalesAnalyst respectively. The StatisticsAnalyst caches metrics, which are similarly ephemeral. FacilitiesAnalyst and SalesAnalyst, however, cache construction sites, structures, and sources: we want to remember where these are, even when rooms aren't currently visible, and we want that memory to persist.

```
export class CachedConstructionSite {
    @Transform(transformRoomPosition)
    public pos: RoomPosition;
    public id: Id<ConstructionSite>;
    public structureType: StructureConstant;
    public progress: number;
    public progressTotal: number;

    public get gameObj() : ConstructionSite|null {
        return Game.getObjectById(this.id);
    }

    constructor(site: ConstructionSite) {
        this.pos = site?.pos;
        this.id = site?.id;
        this.structureType = site?.structureType;
        this.progress = site?.progress;
        this.progressTotal = site?.progressTotal;
    }
}
```

Right now, we're doing double serialization: first when we serialize these with class-transformer, then when Memory is serialized behind the scenes. This is a significant source of slowness. Instead of trying to serialize/deserialize this class into Memory, let's take a different approach.

This is the relevant data that we store as JSON in Memory:

```
{
    pos: {x: number, y: number, roomName: string},
    id: string,
    structureType: string,
    progress: number,
    progressTotal: number
}
```

So, instead of having a collection of CachedConstructionSites, let's just create a Proxy that references the data on the Memory object:

```
interface GenericSite {
    pos: RoomPosition,
    id: Id<Structure|ConstructionSite>,
    structureType: StructureConstant,
}

export interface CachedStructure extends GenericSite {
    id: Id<Structure>,
    gameObj?: Structure,
}

export interface CachedConstructionSite extends GenericSite {
    id: Id<ConstructionSite>,
    progress: number,
    progressTotal: number
    gameObj?: ConstructionSite,
}

const siteProxy = <T extends GenericSite>(constructionSite: T): T => {
    return new Proxy(constructionSite, {
        get: (target, prop: keyof T) => {
            if (!target) {
                return undefined;
            } else if (prop === 'pos' && target.pos) {
                return new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName);
            } else if (prop === 'gameObj') {
                return Game.getObjectById(target.id) || undefined;
            } else {
                return target[prop];
            }
        }
    })
}

const sitesProxy = <T extends GenericSite>(constructionSites: {[id: string]: T}): {[id: string]: T} => {
    return new Proxy(constructionSites, {
        get: (target, prop: string) => {
            return siteProxy(target[prop]);
        }
    })
}
```

Now we can store in Memory the things we care about (the id, position, etc.) and reconstitute the RoomPosition and GameObject only as needed. No need to manage our own deserialization here!

# Consequences

After cleaning out every vestige of class-transformer, performance increased dramatically, to a point where I am using less CPU now on MMO than I was before the rewrite. Clearly, custom serialization was not as good an idea as I originally thought. If I were to have a need for custom serialization again, I'd look at RawMemory segments instead of Memory to avoid the double cost of serialization.

The cleanup routines for HRManager and TaskManager were also responsible for removing completed requests from the list. When I cleaned out the serialization, I also wiped out that logic, causing completed requests to pile up and block further work. I awoke to find my bustling enterprise had been reduced to two creeps! Luckily it was an easy fix and they are back at it again.