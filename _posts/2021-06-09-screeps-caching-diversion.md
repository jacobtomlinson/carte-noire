---
layout:     post
title:      "Screeps #16: A Caching Diversion"
date:       2021-06-09 22:00:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

Note: This article was drafted back in November. See the Conclusion section for some additional perspective on these changes.

# Caching Complications

In [a previous article](https://www.jonwinsley.com/screeps/2020/10/29/screeps-world-state/) we built an object-oriented cache of our WorldState, using decorators and custom property definitions to create dynamic classes that can transparently get data from game objects and cache it either in heap or Memory in case vision is lost.

After a bit of setup, this makes interacting with the world state easy. We can get or set properties from any part of the state tree and trust that they will be properly preserved across ticks or global resets. However, there are some drawbacks:

1. Complexity. Caching becomes a web of logic, dependent upon non-standard patterns. Decorators are fancy, but this pattern probably isn't intuitive for other developers, and it hides a convoluted mess. This in turn makes debugging more difficult.
2. Hackery. We are going to a lot of effort to convince Typescript of the types of our properties, and it turns out we've left some holes, especially when objects are just being created. Refreshing data involves more hackery, in which we get each property without actually using it, and Sonar rightly complains about this.

This becomes particularly acute because I am trying to test room planning and expansion. The complexity and fragility of the caching system means it's routinely breaking on me when I respawn on my private test server. In order to move quickly and test thoroughly, I need to have consistent, reliable startups.

## Weighing Options

Let's take a step back. The object-oriented approach is not the only way to maintain a central state, and it's possible that it's the wrong tool for the job. The fact that we are using Maps as indexes (with their cumbersome `.get()` methods) means we could about easily do something with functions:

```
let plan = worldState.rooms.byRoom('W1N1')?.roomPlan.get();
worldState.rooms.byRoom('W1N1')?.roomPlan.set(plan);
```

This removes the complexity of the decorators, and makes Typescript happier. We would still be managing the cache methods on the back end, attaching them to each field, which means the fields would also need an index - in this case, the room name - so they could be rebuilt. This probably means building fields dynamically, something like this:

```
byRoom(roomName: string) {
    return {
        roomPlan: CachedField<string>(roomName, memoryGetter)
    }
}
```

But if we're going to do this, it's probably simpler and more efficient to abandon the tree and group the data by type, rather than by context:

```
class RoomPlans {
    byRoom(roomName: string) {
        return Memory.RoomPlans[roomName]
    }
}
```

Let's suppose these modules store their heap cache in their module scope, and other state modules reference them as needed. This does introduce some other considerations: If these modules depend on one another (as `byOffice` indexes depend on the `territoryOf` field in WorldRooms) we need to be careful to avoid circular dependencies.

If we aren't careful, these contexts can result in a lot of wasted cycles. For example, let's suppose we have a Structures context that tracks position, hit points, etc. of structures, and then we also have a Capacities context that tracks free/used/total capacity for anything that has a Store (a structure, creep, etc.). If we separately loop through "all structures" and "all game objects with a store" we'll have (potentially) quite a bit of overlap.

Furthermore, we don't necessarily even care about caching all structure data: all owned structures grant vision, so we never need to cache these. But we don't want to have separate Contexts to get the capacity of a storage vs. a container.

So, let's see if we can simplify this to eliminate the bugs we're running into.

# Architecture

## Data Pillars

The Memory tree will serve as one of our Data Pillars, and we'll create a global Heap object to serve as the other. We'll allow each Context to specify interfaces to extend the tree, if they need to cache data.

## Contexts

We'll define a Context as a related subset of data. This might be Capacity, Structure details, or generated Room Plans. Some of the data in a Context might be fetched from game objects, while others might be fetched from a cache; some of it might be fetched from a cache, but only if the game object isn't visible.

We'll pick Capacity as our example here. Let's start with a simple, non-cached example:

```
class Capacity {
    byId(id: Id<Creep|AnyStoreStructure>, resource: ResourceConstant = RESOURCE_ENERGY) {
        let store = Game.getObjectById(id)?.store as GenericStore
        return {
            capacity: store?.getCapacity(resource),
            used: store?.getUsedCapacity(resource),
            free: store?.getFreeCapacity(resource),
        }
    }
}
```

We'll cache these values in Heap, so that if we have a remote container, we can remember how much energy we have stored even if we lose vision to the room. That's helpful, but not important enough to clutter Memory with. So, let's add a check to pull these from Heap if the target isn't visible:

```
declare namespace GreyCompany {
    type CapacityCache = {
        capacity?: number,
        used?: number,
        free?: number
    }
    interface Heap {
        capacity: Record<string, Record<ResourceConstant, CapacityCache>>
    }
}

class Capacity {
    byId(id: Id<Creep|AnyStoreStructure>, resource: ResourceConstant = RESOURCE_ENERGY) {
        let store = Game.getObjectById(id)?.store as GenericStore
        if (!store) {
            return global.Heap?.capacity[id][resource] ?? {};
        }
        return {
            capacity: store?.getCapacity(resource) ?? undefined,
            used: store?.getUsedCapacity(resource) ?? undefined,
            free: store?.getFreeCapacity(resource) ?? undefined,
        }
    }
}
```

Note that we have not yet actually cached anything. So, each tick, we want to:

1. Look at all the visible rooms. For each room:
2. For each unowned structure in the room:
3. Cache the structure's capacity
4. At the end of the room's loop, if there are any cached items from the same room that were not observed, remove them

In this case, we could actually shortcut further: we only need to cache this if we don't own the room's controller (because that would give us permanent vision). We could go further and cache this only if it's in a room designated as a remote mining territory, but as we aren't currently doing remote mining, I'll skip that. (Ignore the fact that this example is almost entirely irrelevant if we aren't doing remote mining.)

If it becomes necessary, we could improve this somewhat by memoizing some filtered results each tick (like the "unowned structures" set) to share between similar Contexts. But that adds some more complexity, so let's hold off on that for the moment. 

We'll run this refreshCache method every tick:

```
refreshCache() {
    // Initialize the Heap branch, if necessary
    global.Heap ??= {}
    global.Heap.Capacity ??= {idByRoom: {}, data: {}};

    for (let roomName in Game.rooms) {
        // Initialize the Heap branch, if necessary
        global.Heap.Capacity.idByRoom ??= {};
        let existingIds = new Set(global.Heap.Capacity.idByRoom[roomName]);
        global.Heap.Capacity.idByRoom[roomName] = new Set();

        // We only need to cache if controller is unowned
        if (!Game.rooms[roomName].controller?.my) {
            for (let container of Game.rooms[roomName].find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER) as StructureContainer[]) {
                // Update currently cached IDs
                global.Heap.Capacity.idByRoom[roomName].add(container.id);
                existingIds.delete(container.id);
                // Cache capacities for each resource type
                for (let resource of RESOURCES_ALL) {
                    global.Heap.Capacity.data[container.id] ??= {};
                    global.Heap.Capacity.data[container.id][resource] = {
                        capacity: container.store.getCapacity(resource) ?? undefined,
                        used: container.store.getUsedCapacity(resource) ?? undefined,
                        free: container.store.getFreeCapacity(resource) ?? undefined,
                    }
                }
            }
        }

        // Clean up any un-cached IDs
        for (let id of existingIds) {
            delete global.Heap.Capacity.data[id];
        }
    }
}
```

Now, let's talk about indexes. We tend to look up world items by ID, by room, by Office (the central room and its controlled territories), by position, by type (structure or minion), or by ownership.

For now, the only index we're persisting is by room, and only for cached data. We could cache indexes to improve performance, but for now, we'll just put in placeholder functions that use `FIND_*` and `LOOK_*` constants and then filter down:

```
static byPos(pos: RoomPosition): Partial<ConstructionSite>|undefined {
    if (Game.rooms[pos.roomName]) {
        // We have vision here
        return pos.lookFor(LOOK_CONSTRUCTION_SITES).find(c => c.my)
    } else if (!Memory.ConstructionSites) {
        return;
    } else {
        for (let id in Memory.ConstructionSites.data) {
            let site = Memory.ConstructionSites.data[id];
            if (!site.posPacked) continue;
            if (pos.isEqualTo(unpackPos(site.posPacked))) return site;
        }
        return;
    }
}
```

# Conclusion, and a Caution

I am writing this section six months after drafting the above article. My second son was born in late November, and Screeps had been sidelined as I balanced first the demands of a newborn and then another side project (which I may write about eventually). I dusted off my codebase, particularly the changes described here, which were left in an incomplete state.

Taking a break is a valuable way to get perspective on your work. Six months may be a bit excessive, but working on something else - trying a different programming paradigm - may show you some things you're overcomplicating.

I think this is one of them.

But I'm leaving the article as is (with this caution) because it's the approach that I ended up with. It works, so I'll leave it for now. But we may revisit this later.