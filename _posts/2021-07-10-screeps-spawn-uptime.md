---
layout:     post
title:      "Screeps #18: Spawn Uptime"
date:       2021-07-10 22:45:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

![A chart displaying history of spawn energy levels](/assets/screeps-reports-metrics-1.png)

# Baseline Expectations

Currently, my minions are only keeping HR at about 1/3rd of its capacity. I think we can do better. Let's run through the calculations from the end of the previous post.

Spawning a new creep takes three ticks per body part; to ensure 100% uptime, the spawn and extensions would need to be filled before spawning is complete. The average cost of a body part is 160 energy, or 100 if we ignore the expensive claim parts. Each body part takes 3 ticks to spawn, so on average, we need to fill extensions at a rate of 33.3 energy/tick to achieve 100% spawn uptime. 

At level 7, we get two spawns, and at level 8 we have three. To maintain uptime for all spawns, we need to supply them even faster.

| RCL |Spawns | Extensions | Energy | Ticks |
|-----|-------|------------|--------|-------|
| 1   | 1     | 0          | 300    | 9     |
| 2   | 1     | 5          | 550    | 15    |
| 3   | 1     | 10         | 800    | 24    |
| 4   | 1     | 20         | 1300   | 39    |
| 5   | 1     | 30         | 1800   | 54    |
| 6   | 1     | 40         | 2300   | 69    |
| 7   | 2     | 50         | 5600   | 84    |
| 8   | 3     | 60         | 12900  | 129   |


Let's set aside the question of supplying energy to the Office for the moment. We'll create a stockpile in Storage, so assume we have all the energy gathered centrally that we will need. We'll worry about limits later.

## Logistics

![Extensions layout](/assets/screeps-spawn-uptime-1.png)

Currently, our logistics code has a single kind of minion, the Carrier. Its job is to fill up at a LogisticsSource (which could be a Link, a Source container, or even a spawn) and then supply as many LogisticsRequests as it can.

This has the disadvantage that a request to fill extensions must wait until the Carrier travels to the source, fills up, and returns. For sources in the same room, this is just a little slow; but for remote sources, it's downright inefficient. Let's test an alternative.

### Long-Range Hauling

Let's make a simple change first. Short-range distribution requests - extensions, spawns, towers - should prefer to fetch from central storage rather than a primary source. The storage's requests will always be filled from primary sources. This should help make sure that the distribution loop is as short (and fast) as possible.

After testing this for a while, the results are generally better. We can refill spawns and extensions in under 100 ticks - if we have enough energy in storage, and enough active Carrier minions. There are a few minor optimizations we can make, such as having Salesmen supply adjacent spawns.

But this lets us analyze our metrics separately: we can track the throughput of those primary requests. Our income from Sources should closely match our throughput (the energy being deposited centrally). If the throughput is significantly lower, there may be a leak: loose resources decaying, or Engineers drawing from source containers.

After watching these metrics for a while, the throughput and income are *generally* aligned:

![Throughput slightly lower than income](/assets/screeps-spawn-uptime-2.png)

But we go through regular cycles, where we lose some carriers, throughput suffers, then the carriers are eventually respawned to meet demand. This spawn logic is hurting our overall efficiency. We should be able to improve our spawn logic to maintain a more consistent workforce.

### Improving Spawn Logic

Currently, we are checking the game state each tick, looking for the highest priority spawn opportunity. If we have unfulfilled logistics requests, we spawn a Carrier; if we have unfulfilled harvest requests, we spawn a Salesman. But there's some other logic to prioritize Salesmen over Carriers if we have too few.

It's a little complicated and prone to swings. Instead of responding to demand, let's predict the capacity we need and generate quotas for each type of minion.

Salesmen are easy to predict: we need enough work parts to completely mine the sources.

```typescript
const franchiseCount = salesAnalyst.getExploitableFranchises(this.office).length;
const workPartsPerSalesman = Math.min(5, Math.floor((Game.rooms[this.office.name].energyCapacityAvailable - 50) / 100));
const salesmenPerFranchise = Math.ceil(5 / workPartsPerSalesman);
const targetSalesmanCount = franchiseCount * salesmenPerFranchise;
```

Carriers are slightly more difficult, but in tests so far, the dynamic spawn logic ends up generating about as many carriers as Salesmen. We'll test that and adjust as needed.

```typescript
const targetCarrierCount = targetSalesmenCount
```

The other minions will be populated similarly - Engineers based on work to be done, one Paralegal to upgrade the controller (or more, if the Engineers are done), etc. However, we'll always prioritize Carriers and Salesmen, as they are the key to steady energy inflow.

Things are looking better:

![Throughput slightly lower than income](/assets/screeps-spawn-uptime-3.png)

With remote mining, we're sometimes getting our 33 energy/tick to maintain 100% uptime! But remote mining is also demanding our spawn's full attention once we reach around RCL 4. Averages in our table notwithstanding, our creeps' builds actually take around 100 ticks to spawn. With a lifetime of only 1500 ticks, this translates to about 14 minions - max. In practice, we're struggling to maintain six each of Salesmen and Carriers, and there's no spawn time left over for other minions.

I ran a test on a private server with and without remote mining. Specifically, the Office tries to mine up to three remote sources at RCL4. Remote mining unlocked RCL4 about 3,000 ticks sooner (24k instead of 27k) but was 3,000 ticks *slower* hitting RCL5 - a net loss of 6k ticks. I tested it with two remote sources instead of three, and this improved the time, but not significantly more than with remote mining disabled.

Breaking even isn't worth it: I'll disable remote mining until we hit RCL 7/8 and have more spawn capacity.

This post has been kind of scattered, but we've made some significant stabilizing improvements. I think we're finally ready to take the big next step: claiming our first new office. This will be the subject of the next post.