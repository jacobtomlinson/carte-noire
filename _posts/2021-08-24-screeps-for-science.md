---
layout:     post
title:      "Screeps #22: For Science"
date:       2021-08-24 10:30:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Building Labs

It's time to tackle something I've been secretly dreading: Labs! I don't have a good mental model for how I want to this to work yet, so it feels kind of overwhelming. Let's analyze this and find some smaller pieces to chew on.

## Overview

Labs combine Minerals (which we've begun harvesting in a previous installment) into Compounds. These are primarily used to boost creeps, making them [harder, better, faster, stronger](https://www.youtube.com/watch?v=yydNF8tuVmU), but ghodium in particular can also be used to buy safemodes and launch nukes. Labs will also apply the boosts to creeps, at the cost of some energy.

Our complete lab code needs to determine what boosts are needed; determine what compounds are needed to create those boosts; and determine whether to create those compounds or buy them from the market. Then it needs to move the minerals/compounds to the room via terminals; fill the labs; run the reactions; and move the products back to storage. When it has enough, it needs to coordinate filling the labs with the spawning of a new ready-to-boost minion. That's... a lot. So, let's break it up into smaller steps.

We can put off deciding *what* to make until later, and set that manually for now, while we're testing on our private server. We still need to share minerals between our rooms, and then get them into the labs. So, let's talk about our process first.

# Process Management

There are two pieces of this process. Getting materials from Storage to the Lab and back is comparatively easy, but first we need to get the materials to our rooms. We need to share materials via our terminal network.

## Terminal Logistics

Our Terminals can send resources between rooms at the cost of energy. We need a way to express each room's need for resources and find an efficient way to fill that need.

Let's start simple with a Quota:

```typescript
declare global {
    interface OfficeMemory {
        resourceQuotas: Record<ResourceConstant, number>
    }
}
```

We can compare this with what we have on hand to calculate need/surplus:

```typescript
export function officeResourceSurplus(office: string) {
    const totals: Partial<Record<ResourceConstant, number>> = {};
    const plan = roomPlans(office)?.headquarters;
    for (let [resource, amount] of Object.entries(Memory.offices[office].resourceQuotas)) {
        totals[resource as ResourceConstant] = -amount +
            ((plan?.terminal.structure as StructureTerminal).store.getUsedCapacity(resource as ResourceConstant) ?? 0);
    }
    return totals;
}
```

Now our goal is to balance these to get as close to 0 as possible (since a surplus is positive, and a deficit is negative). If we have a surplus for a resource in one room and a deficit in another, we'll send that surplus over to the other room. If no other room needs the resource, we'll look to sell it on the Market instead.

For now, we'll concentrate all of our trade materials in the Terminal. Eventually we may keep some in Storage, but that will complicate our code, as fulfilling an imbalance will take multiple ticks (withdraw from Storage, deposit in Terminal, transfer). Let's keep things simple to start with.

And just like that, our rooms have an assortment of minerals to experiment with.

# A Brief Interlude for RCL 8

During this experiment I enabled screepsmod-konami on my private server to speed up building & upgrading. As a result, my rooms began to reach RCL 8 for the first time, uncovering a host of new issues. (And I discovered an issue with screepsmod-konami - it's missing the constant for factory construction costs!)

First, we had no real way to handle an energy surplus: pre-RCL 8, the plan was to spawn extra upgraders when Storage had more energy than budgeted. At RCL 8, we're capped to 15 e/t, which is less than half the energy our rooms (with remotes) are bringing in. We need to make sure this energy surplus gets distributed to other rooms that are still upgrading. This is mostly just a modification to our office Logistics minion, to balance energy between storages and terminals, so that a surplus gets automatically distributed to other rooms.

Second, except for room planning (which is a one-time expense), we weren't scaling operations based on available CPU. At six rooms (with remotes) we had 140 minions and were using an average of 75 out of 100 CPU. We need to do better - a *lot* better. After some targeted profiling and optimizing my movement function (shared by all creeps), I was able to cut this from an average of 0.5 CPU/creep to 0.3 CPU/creep.

Here's a helpful snippet for inline profiling of sections of a function:

```typescript
let log = new Map<string, [number, number]>();
let loggedTicks = 0;
let last = 0;
let reportedTick = 0;

export const logCpuStart = () => last = Game.cpu.getUsed()
export const logCpu = (context: string) => {
    if (reportedTick !== Game.time) {
        for (let [c, data] of log) {
            const invocationsPerTick = data[0] / loggedTicks
            const averagePerInvocation = data[1] / data[0]
            console.log(`${c}: ${(invocationsPerTick).toFixed(3)} x ${(averagePerInvocation).toFixed(3)} = ${(invocationsPerTick * averagePerInvocation).toFixed(3)}`)
        }
        loggedTicks += 1;
        reportedTick = Game.time;
    }
    const [invocations, time] = log.get(context) ?? [0, 0];
    const cpu = Game.cpu.getUsed();
    log.set(context, [invocations + 1, time + (cpu - last)]);
    last = cpu;
}
```

Put the `logCpuStart()` at the top of the section you want to profile, and then after each significant section, call `logCpu()` with a name for the context. It will track a running average of how many times the context is hit and time it takes and stream the output to the console once per tick. `screeps-profiler` works for functions and classes, but doesn't do much when you need to find out which *part* of a long function is eating all the CPU.

# Back to Science

We have minerals in our terminal - hooray! Now we need to fill and run our labs. The first step is designating our input/output labs:

![A figure-8 lab layout with center 2 labs marked as inputs](/assets/screeps-for-science-1.png)

All of these output labs can use the same two input labs simultaneously. We'll start creating the two input labs and one of the output labs; at RCL7 we'll create three more output labs; then at RCL8 we'll finish the remaining output labs.

## Operations

Now, our Scientists have one primary role: shuffle resources between the Terminal and the Labs. For now, we'll aim for continuous production: an office has a pre-set reaction, and the Scientist will carry ingredients from the Terminal to the input labs for that specific reaction. It'll pick up any output resources and return them to the Terminal.

Our first target for boosts will be catalyzed ghodium acid, for a 100% increase in controller upgrade effectiveness. This requires several intermediate steps: zynthium keanite and utrium lemergite, combined to make ghodium; ghodium combined with hydrogen to make ghodium hydride; oxygen and hydrogen to make hydroxide; ghodium hydride and hydroxide to make ghodium acid; and, finally, catalyst and ghodium acid to make catalyzed ghodium acid.

We'll start with a simple order queue.

```typescript
interface LabOrder {
    ingredient1: ResourceConstant,
    ingredient2: ResourceConstant,
    product: ResourceConstant,
    amount: number,
}
```

The `amount` will be decremented only when the output compound is actually deposited in the Terminal. We'll calculate the amount in process based on the ingredients and compounds in the labs and Scientists' inventories. Then, scientists will withdraw and transfer ingredients, if needed, until the in-process amount equals the target amount.

To minimize loss of resources, we'll have the Scientists renew themselves at the nearest Spawn when they're getting low.

The operational logic will look something like this:

1. If needed, renew the Scientist.
2. If the current order needs more ingredients, get the correct amount from Terminal and transfer them to input labs.
3. After dropping off a load of ingredients, pick up any product that is ready (minimum 100 units) and ferry back to the Terminal.
4. Once all ingredients for the order have been supplied, wait for the product to be ready and ferry it back to the terminal.
5. If the ingredients or products actually in the labs don't match the current order, empty the labs and start fresh.

There's some room for optimization here, but this should do for a start.

## Formulations

Now, ideally, we don't want to think about all the ingredients each time we submit an order: we should decide that we want a thing (say, catalyzed ghodium acid), and then calculate the ingredients we need. It should also take into account the best way to source the ingredients: either from a mining operation or from the market.

Calculating ingredients is fairly simple. We'll start with a list of dependencies (strangely, this doesn't already exist as a constant):

```typescript
export const RESOURCE_INGREDIENTS: Record<MineralCompoundConstant, [ResourceConstant, ResourceConstant]> = {
    [RESOURCE_HYDROXIDE]: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN],
    [RESOURCE_ZYNTHIUM_KEANITE]: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
    [RESOURCE_UTRIUM_LEMERGITE]: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM],
    [RESOURCE_GHODIUM]: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE],
    // ...etc.
}
```

Now we can generate lab orders like this:

```typescript
export function getLabOrderDependencies(order: LabOrder): LabOrder[] {
    const ingredients: LabOrder[] = [];
    if (order.ingredient1 in RESOURCE_INGREDIENTS) {
        ingredients.push({
            ingredient1: RESOURCE_INGREDIENTS[order.ingredient1 as MineralCompoundConstant][0],
            ingredient2: RESOURCE_INGREDIENTS[order.ingredient1 as MineralCompoundConstant][1],
            amount: order.amount,
            output: order.ingredient1,
        })
    }
    if (order.ingredient2 in RESOURCE_INGREDIENTS) {
        ingredients.push({
            ingredient1: RESOURCE_INGREDIENTS[order.ingredient2 as MineralCompoundConstant][0],
            ingredient2: RESOURCE_INGREDIENTS[order.ingredient2 as MineralCompoundConstant][1],
            amount: order.amount,
            output: order.ingredient2,
        })
    }
    return ingredients.flatMap(o => getLabOrderDependencies(o)).concat(ingredients)
}
```

If we can get these resources from somewhere else - storage, market - then we can reduce the amount or eliminate the sub-order completely. For now, we'll focus just on resources in the Terminal; our market code is nearly nonexistent, and we haven't yet looked at calculating the cost of mining vs. purchasing minerals. This will be important - in most scenarios we won't have a room for every mineral, so we'll need to purchase resources - so we'll put this on the to-do list.

We don't need to recalculate this every tick, but it's possible that we'll lose a batch here or there. If the Scientist tries to get some ingredients from the terminal and is unable, the order queue for the current priority should be recalculated.

## Initial Strategies

So how do we determine what that current priority should be? At present we've just hard-coded our goal for the sake of the implementation. Ultimately this will be driven by our code for spawning and boosting minions. Without a better idea of what that will look like, we'll settle for maintaining a quota of ghodium and hydroxide compounds, useful for a variety of structures, boosts, or both.

# Conclusion

In the next installment we'll tackle the market code, to make sure we have a reliable source for minerals even when rooms are difficult to come by. Then we'll figure out boosts.

Botarena is coming up very soon, so in the interests of a good showing, I plan to disable this currently experimental labs code and do some stress testing to try to catch any obvious bugs. I expect I'll still do poorly without more advanced features, but I'm hoping to at least have a stable energy economy and working expansion code.