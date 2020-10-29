---
layout:     post
title:      "Screeps #13: World State"
date:       2020-10-29 15:45:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# World State

To recap from last time, we want to rewrite our disconnected Analyst caches into one central repository of data about the known world state.

To begin with, we can identify a few layers of data:

* The raw world state (anything we pull from the game APIs): terrain, minion locations, structures, controller level
* Computed world state (anything we add to the game data): influence levels, territory intents, Franchise locations
* Selectors (meaningful groups of world state date): Salesman minions, sources in safe territories, all of my construction sites

Some data should be cached in Memory (so it persists across ticks and global resets); some should be cached in the heap (but isn't a big deal if we rebuild it after a global reset); and some doesn't need to be cached at all.

I started writing out an initial design, scrapped it, and then as I was working on a second pass decided to build a library around the World State instead. This will make it easier to share the code than posting snippets here, and may make it easier for others to contribute and improve the ideas.

[Here's the repo](https://github.com/glitchassassin/screeps-cache). Let's dig in.

## Requirements

I want to keep track of known Structures. I need to know where my roads and buildings are and their hitpoints to schedule repairs, and if I have containers in a remote room, I need to remember where they are when I don't have vision to that room. Let's use these as a representative example of a data type in our World State.

Let's start with Containers. We want to track their `id`, `pos`, and `structureType` in Memory. If we have a global reset, we'll still know where the container is expected to be. `hits` aren't as critical, so we can track these in heap so as not to clutter Memory. Finally, let's say we also want to track the `franchise` in Memory to identify if the container is a LogisticsSource.

To minimize duplication, data stored in Memory (like `structureType`) should be pulled directly from the Memory object - not copied to an additional structure in the heap. But we still have some cached data that will live in the heap (`hits`, for example).

## Theory

It's easy enough to write a getter that references memory:

```
class CachedContainer {
    constructor(public id: Id<StructureContainer>) {}

    public get structureType() : StructureConstant|undefined {
        let o = Game.getObjectById(this.id);
        if (o) {
            Memory.containers[this.id].structureType = o.structureType;
        }
        return Memory.containers[this.id].structureType;
    }
}
```

Or one that caches a response in heap:

```
class CachedContainer {
    constructor(public id: Id<StructureContainer>) {}

    private _hits?: number;
    public get hits() : number|undefined {
        let o = Game.getObjectById(this.id);
        if (o) {
            this._hits = o.hits;
        }
        return this._hits;
    }
}
```

But doing this manually, for every prop on every type of data we want to cache, is going to take a while and involve a lot of duplication. We should be able to reuse the getter function, but Typescript's property getters don't let us reuse functions. Instead, let's set up these getters with Object.defineProperty().

```
const getFromHeapCache = <T>(getter: () => T|undefined) => {
    let cache: T|undefined;
    return () => {
        cache = getter() ?? cache;
        return cache;
    }
}

class CachedContainer {
    constructor(public id: Id<StructureContainer>) {
        Object.defineProperty(this, 'hits', {
            get: getFromHeapCache(() => Game.getObjectById(this.id)?.hits ?? undefined)
        })
    }
}
```

Hmm... small problem: because we're defining the property dynamically, Typescript doesn't recognize it. Not to worry! There's a workaround: Decorators. With some hackery, we are able to reduce the above to decorators that we can assign to our data classes, caching individual properties in Memory or the heap as needed.

I've compiled these decorators [in a separate repository](https://github.com/glitchassassin/screeps-cache/), so you can use them too with `npm install screeps-cache` (assuming you're using npm for your code: if not, check out the [Screeps Typescript starter](https://github.com/screepers/screeps-typescript-starter)).

Now we can have a generic CachedIDItem class like this:

```
export class CachedIDItem<T extends RoomObject & _HasId & _HasRoomPosition> {
    constructor(public id: Id<T>) {
        // Refresh item properties
        for (let i in this) {}
    }

    @memoryCacheGetter(keyById, (i: CachedIDItem<T>) => Game.getObjectById(i.id)?.pos, asRoomPosition)
    public pos!: RoomPosition;

    public _scanned: number = Game.time;
    @memoryCacheGetter(keyById, (i: CachedIDItem<T>) => {
        if (i.gameObj) { i._scanned = Game.time; }
        return i._scanned;
    })
    public scanned!: number

    public get gameObj() { return Game.getObjectById(this.id); }
}
```

We can extend this class for any RoomObject with an ID and position.

Now, once we cache the item, we need to maintain a list of these items in Memory so that we can reload them after a global reset. As long as we have a list of the IDs, we can `new CachedIDItem(id)` and immediately recover anything that was cached in memory under that ID. Some additional tooling will let us scan the room, creating new CachedIDItems when new items appear, and getting rid of destroyed/missing ones.

*seven days and hundreds of bugfixes later...*

That... was a much bigger ordeal than I anticipated. But we have now achieved the following:

* We can track lists of game objects or custom data.
* We can cache any part of that data in either heap or Memory, as appropriate.
* We can reload those lists after a global reset.
* Despite the complexity behind the scenes, the external interface is fairly simple.

## Selectors

We'll keep the Analysts to serve as selectors, filtering the WorldState to answer specific questions. For example:

```
export class HRAnalyst extends BoardroomManager {
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getExtensions(office: Office) {
        let structures = global.worldState.structures.byRoom.get(office.center.name) ?? [];
        return Array.from(lazyFilter(structures, s => s.structureType === STRUCTURE_EXTENSION)) as CachedStructure<StructureExtension>[];
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getSpawns(office: Office) {
        return Array.from(global.worldState.mySpawns.byRoom.get(office.center.name) ?? []) as CachedStructure<StructureSpawn>[];
    }
    @Memoize((office: Office, type?: string) => ('' + office.name + type + Game.time))
    getEmployees(office: Office, type?: string) {
        return Array.from(lazyFilter(
            global.worldState.myCreeps.byOffice.get(office.name) ?? [],
            creep => !type || creep.memory?.type === type
        ))
    }
}
```

Here we're getting Sets of CachedStructures or CachedCreeps from the WorldState. Because these are iterables, not arrays, I wrote a `lazyFilter` generator to filter the results. (I think this is a bit more performant than creating an array first, but I haven't tested for certain.) Then we're converting that to an array for the convenience of the Manager that is querying the information.

# Conclusion

I started writing this post a week ago, and am just now getting the conversion to a stable state. There are a few improvements left to make. Muon just released [screeps-packrat](https://github.com/bencbartlett/screeps-packrat) to compress IDs, coords, and RoomPositions so they take up less room in Memory. I'll add this into screeps-cache, and then take a break from the world state.

While I've been working on this, my central room in MMO filled its storage and then suffered a serious population crash from which it is not recovering - that will require my attention next. This should tie in nicely to our next focus: Decision Making.