---
layout:     post
title:      "Screeps #20: The Great Purge"
date:       2021-08-10 09:00:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# The Great Purge

While working on what was to be the next article, dipping our toes into the shark-infested waters of combat, I found myself running into issue after issue. Debugging was becoming a nightmare, and it was getting harder to conceptualize what I was trying to accomplish.

In the middle of one of those frustrations, there was a discussion on the new Screeps Discord about task management strategies. klimmesil mentioned that Tigga had said task-managed scripts weren't worth the effort. That stuck in my mind, and I began to wonder what I could do instead. I hit on an idea, and had planned to just replace my existing task management system. Instead, I got a little carried away, and rewrote my game loop from the ground up.

## The New Approach

My great weakness thus far has been the temptation to overengineer a complex flexible solution, only to later discover that a simple hard-coded solution is both more efficient and more effective. So, I went back to the basics, throwing out my Boardroom, Office, and Manager classes. For the most part, I stuck with simple functions and a basic game loop that iterates once over the visible rooms, once over the cached Offices, and once over all creeps.

I eliminated almost all of the complex caching: most of the things I was caching didn't need to be, and the things that did need to be kept could be simply saved to Memory. 

My room planner was preserved mostly intact, with the exception that it no longer relies on those WorldState caches.

Finally, I even dropped (most of) the behavior trees I was using for creep logic. They hid a tangled mess of obscure dependencies and logic bugs. I have kept some of the abstractions (moveTo, getEnergy, etc.) and implemented them with simple if-logic and state machines.

The most significant part of the approach are Objectives.

```typescript
export abstract class Objective {
    public id: string;
    constructor(public priority: number = 5) {
        this.id = this.constructor.name;
    }
    public assigned: Id<Creep>[] = [];

    /**
     * The BehaviorTree for all creeps (regardless of office)
     */
    abstract action: (creep: Creep) => void;

    /**
     * Checks to see if this Objective needs more minions in the
     * given office. If so, attempt to spawn them using one or
     * more of the provided list of spawns.
     */
    abstract spawn(officeName: string, spawns: StructureSpawn[]): number;

    /**
     * Returns estimated energy/tick to run this objective (positive
     * if net income, negative if net loss)
     */
    abstract energyValue(officeName: string): number;
}
```

This replaces behavior trees, task management, and spawn logic. Instead of trying to coordinate minions-to-spawn and tasks-to-do separately, an Objective tracks both. It spawns its own minions and has them carry out their roles. In most cases, there's a single global Objective, shared by all offices. Any state the creep's behavior needs to reference is either stored in the creep's memory or elsewhere (in the Office memory, perhaps).

The ExploreObjective, to pick a simple example, has an Action to pick a room to explore; assign it to a creep; and then send the creep to explore its assigned target. For each office, it spawns one Intern if one doesn't already exist.

The energyValue is an interesting side effect of this architecture. The Objective knows how many minions it wants to spawn for a given office, so it can calculate the average cost of those minions per tick; predicted cost of any energy used by the minion (on building or repairs, e.g.); and predicted income (for harvesters). Then we can do things like spawning just enough Engineers to use the leftover energy we're generating, and it'll scale with each additional Franchise we harvest.

## Results

So far, this *feels* better to work with. I'm able to develop and debug faster, my code is simpler and more concise, and in most cases I'm able to get the data I need for measuring improvements fairly easily. 

I lost my old Grafana dashboards when I replaced my old computer which had been hosting the instance, so I went ahead and rebuilt it. That does a better job of giving me historical data on how my colony is performing for debugging purposes.

Performance-wise, the new code does much better, taking closer to 4 CPU for one room instead of 11. Some additional tuning has improved startup time too, getting us to RCL4 in under 18k ticks! This will be helpful for the Botarena competition coming up at the end of August. Yes, the Grey Company is entering - and the pressure is on. 

# Botarena Priorities

[Botarena](https://screepspl.us/events/#botarena) is a competition for fully-automated bots, no human intervention/code changes/flags/etc. after the first safe mode drops. Victory is based on total RCL across all rooms at the close of the competition.

My initial priorities are as follows:

1. Make sure that the RCL1-8 process is solid.
2. Test room planning for issues and edge cases in a variety of rooms.
3. Make sure expansion is smooth and quick.
4. Make sure CPU efficiency scales well to multiple rooms.
5. Implement passive and active defenses (article coming up, I promise)

I don't think I'll have time to properly implement labs, boosts, or power mining, but we'll see. I don't expect to have a strong end game without them, but if I can manage a decent showing and come away with notes for improvement, I'll count that as a victory.