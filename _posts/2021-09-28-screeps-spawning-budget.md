---
layout:     post
title:      "Screeps #23: Botarena!"
date:       2021-09-28 20:45:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Botarena

As promised in the last post, we entered in the Botarena competition and made a valiant effort. I had no real expectation of *winning*, but competition is still an excellent way to improve: you can take notes from your own failures and from everyone else's victories. And there were plenty of both.

I had one game-breaking bug, which caused surplus energy to be sold instead of used for upgrading, so once my rooms reached RCL6 they began to stagnate. The Grey Company still managed to acquire three rooms, so my efforts at testing expansion on a private server were not entirely wasted. There were a handful of other deficiencies, from laughably low rampart levels to simply no lab code, which I turned into issues on the repository to tackle later.

But the most helpful part of the first round was watching Tigga's exponential growth. I'd seen the early-RCL swarm before, but comparing it to our own progress highlighted just how effective it could be. By RCL4 Tigga had 6 rooms reserved and had spikes of 60 energy per tick into upgrading. We were hitting 7-15 energy/tick, with remotes, and was being outpaced by Snowgoose who wasn't bothering with remote harvesting at all.

For all the work we've put into it, there's clearly a lot of room for improving the energy pipeline.

And that energy economy is the foundation of it all: Tiggabot's efficient economy meant that it spread faster than everyone else, dominating more resources, and completely wiped the other competitors in less than a week.

I started working on some fixes and an improved energy economy system, and as a result was woefully unprepared for the Botarena reboot sans Tigga. I spawned in, but my rough draft had critical issues and never got off the ground in the second round. 

Let's pretend *that* didn't happen and instead talk about the economy rewrite.

# Spawning on a Budget

There are three main limitations to how many minions you can maintain: CPU, energy, and spawn time. Minions take a certain amount of CPU to do their work. There's an energy cost to spawn the minion, and then also any ongoing energy cost (for building, repairing, or upgrading). And the fixed creep lifetime means there's a cap on how many creep parts a single spawn can maintain. These costs vary for different tasks - an Engineer constructing extensions will take more energy, and a fleet of Accountants hauling energy from the Franchises will take more spawn time.

To really maximize our effective energy output, we need to optimize our use of these resources.

At the early stages of the game, just after spawning in, spawn time is probably the most significant limiting factor. We only have one spawn and can manage `CREEP_LIFE_TIME / CREEP_SPAWN_TIME = 500` parts total. Some of those parts will go towards harvesting sources; some towards hauling energy back to base; and some towards using it for construction or upgrading. If we put too much into harvesting, we won't be able to haul all the energy back; but if we put too much into hauling, we won't be able to use all the energy, and it will be wasted. We need to balance the input, throughput, and output, within the constraints of CPU, energy, and spawn time.

Yes, this is complicated. Buckle up and we'll dive in.

## Overall Logic

Our baseline budgets, the maximum constraints we have to work with, look something like this:

```typescript
{
    cpu: Game.cpu.limit / numberOfOffices,
    spawn: CREEP_LIFE_TIME * numberOfSpawns(office),
    energy: franchiseIncome(office)
}
```

Above I said we need to balance the input, throughput, and output. I lied; we're going to take a shortcut for the input. Our Salesmen are fairly cheap in terms of spawn time, so we'll always spawn enough to work the sources we intend to harvest. We won't always be able to use all the energy, but it'll be there when we need it. We'll spawn Salesmen to harvest the sources, Marketers to reserve the rooms, and Accountants to haul enough energy to spawn those input minions. Those costs can be calculated up front and subtracted from our baseline budgets as a fixed expense.

Now we're just balancing the throughput and the output, which makes things a little simpler.

Throughput is our Logistics objective. We have a pool of Accountants hauling energy from our Franchises back to the room's central storage. (That storage will be our Spawn, initially; then an adjacent container, at RCL2; then the actual Storage at RCL4.) These Accountants will pull energy from a nearby tombstone, if available; or else from the source with the most available surplus, after accounting for any minions already heading to get energy from that source.

Output includes any other Objective - anything from Facilities to build & repair structures to Defense to spawn guard minions. These all cost a certain amount of energy, CPU, and spawn time. But so does Logistics! Spawning all those Accountants isn't free. If we increase the number of Accountants, we increase the amount of energy available for Output objectives, but we decrease the amount of CPU and spawn time remaining.

So we'll calculate this in reverse.

1. Set the "available energy" to the total income of our franchises.
1. Calculate the budgets for all Output objectives, based on the available energy.
1. Calculate the budget for the Logistics objective to supply that much energy
1. The total budgets will be higher than our constraints. Reduce the "available energy" proportionately and repeat until the total fits.

For example, we might do the initial calculation and find that for the Output objectives to use the full income, the total budget is 2x higher than the energy available and 3x higher than the spawn time available. So, we'd divide the "available energy" by 3 and recalculate. Eventually (usually in two or three iterations) we'll come up with a close approximation that will maximize the Output budgets.

Now we'll save the energy allotted for those objectives in a Ledger. The objectives will check the ledger, calculate how many minions they can maintain with that budget, and spawn accordingly.

## Some Relevant Details

This took a while to actually iron out. Some of the issues I ran into:

### How do you "fit" variable budgets?

Some Objectives have a fairly fixed cost (Explore spawns a single scout, never more), while others are highly variable (Facilities cost varies depending on how much energy is available and how far the structures are). If we split the available energy proportionately among all the Objectives, those fixed-cost Objectives won't use the whole slice and will waste it.

Fortunately, it's fairly easy to tell which Objectives will have a fixed cost, so I just set a flag and sum those separately. The remaining energy goes to the Objectives with a variable cost.

Those start out proportionately - if we have five variable objectives, the first's budget is calculated from 1/5th of the available energy. Then that budget is subtracted from the available energy, and the process repeats for the remaining four. If one uses significantly less than it's allotted, there's no waste, as the extra energy just becomes available to the next objectives.

This still isn't perfect optimization, but it's a close enough approximation.

### How do you calculate budgets?

Each objective predicts its own budget, given an energy limit to work within. The cost per minion calculates the energy to create the minion and any energy it uses during its lifetime - upgraders will use pretty nearly one energy per tick, but builders' efficiency will vary depending how far it has to travel. The number of minions that will fit within the energy limit lets us predict the CPU usage, assuming 0.5 CPU/minion (high, but gives room for error). And, of course, we can calculate spawn time from the minion count and body size.

### What about stored energy?

These budgets just deal with the regular energy flow. We need some extra logic to make sure energy is saved up in Storage, and that it's available for use if we have excess or an emergency.

I elected to simply modify the Logistics budget based on the current level in Storage. If the level is lower than it should be, we scale up the Logistics budget, to make sure more energy flows in; if it's higher than it should be, we reduce the Logistics budget, and the Output begins taking more than we're bringing in, reducing the surplus.

In case of emergency, the Storage budget can be temporarily dropped to a minimal amount, diverting resources to Output objectives instead of Logistics as they draw on Storage directly.

### How do logistics minions prioritize their sources?

We've split logistics minions into a shared pool, no longer dedicated to a single source. Instead, they will target the closest Franchise that gets the minion closest to full. It will pick a more distant franchise that will fill the minion completely over a nearer one with less energy available, but it will stick with the closer franchise if two can both fill the minion completely. And it takes into account other logistics minions heading for the same franchise, subtracting their capacity from the available total.

# Results

![assets/screeps-spawning-budget-1.png](Illustration of RCL milestones table)

Prior to Botarena, I was hitting RCL4 in under 20k ticks, but didn't have reservers or roads to remotes yet. After implementing budgets (and fixing several issues along the way) I had both reservers and roads to remotes and was back to hitting RCL4 in under 20k ticks. We're now hitting RCL5 in ~37k ticks instead of ~80k ticks, and reaching GCL2 aroud 56k ticks, so the new budgets are paying off in long-term efficiency as well.

Tigga got to two rooms early in the first botarena round, and was averaging about 25-30 e/t into upgrading per room. After our changes, we're averaging about 30 e/t at RCL4 as well. The private server is a more ideal setting than botarena, of course - no competition, harassment of remotes, etc. But this is sufficiently competitive that I'm ready to move on to something else.