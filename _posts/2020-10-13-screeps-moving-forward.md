---
layout:     post
title:      "Screeps #11: Moving Forward"
date:       2020-10-17 14:30:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Prioritizing New Features

We've spent a while rehashing this logistics system, rewriting it and then tuning and optimizing some parts of it. There are still some areas that could use help - creating an efficient route from one request to another is fairly slow - but it's at least functional for now. But my Office in Shard3 is being encroached upon, first by Invaders and then by another player settling right next door. So we need to tackle a few more things.

## Scaling Up Construction

After fixing our logistics system, we now have more energy flowing: time to put it to good use. We need to scale up our force of Engineers. My first instinct was to scale up Engineers to build as quickly as possible with the available energy, but I realized this is typically ineffecient: we'll end up with a surplus of idle Engineers once the work is done. Instead, we should build enough Engineers to handle the work that's outstanding.

The Engineer's WORK parts can build for 5 energy/tick. Barring renewals, each WORK part is good for 1500 ticks, so we have an upper limit of 7500 construction energy per WORK part over the lifetime of the Engineer. Practically, the Engineer will spend some of that lifetime moving from one site to another, or waiting for a request. I don't have a good guess for what the actual efficiency will be, so let's assume 50% for now. Each WORK part equates to 3,750 units of useful construction work.

Now we can easily add up the outstanding construction sites and repair sites to calculate the work remaining. In some cases, we might want to overprovision Engineers to get things built more quickly; if the FacilitiesManager is operating at PRIORITY level, it will multiply the work remaining by 1.5, increasing the number of provisioned Engineers.

## Defending Territories

We're a ways out from real combat code; we don't even have functioning labs yet. But we can start with a couple basic units. We'll spawn Realtors to scout our Territories and keep our intelligence up to date, and some basic Guards to hunt down interlopers and protect our franchises.

Scouting is pretty easy: it's just a matter of traveling to a specific destination room. And look, we already have the task for it!

```
action(creep: Creep) {
    // If unable to get the creep or destination, task is completed
    if (!this.destination) return TaskActionResult.FAILED;
    if (creep.pos.roomName === this.destination) return TaskActionResult.SUCCESS;

    let result = travel(creep, new RoomPosition(25, 25, this.destination))

    if (result !== OK) {
        return TaskActionResult.FAILED;
    }
    return TaskActionResult.INPROGRESS;
}
```

Guarding can be more complex, but we'll keep it simple for now. Our Guards will be spawned if there is a room worth defending, and will go there and hunt down hostile minions and spawns. Once the territories are cleared, they'll return to spawn to be recycled.

If someone has started claiming the room, we'll need to unclaim it. Let's upgrade our Lawyers.

## Reserving Territories

Right now, the minions we call Lawyers are just upgrading our central controller. That's a very menial task not worthy of the title. We'll demote these minions to Paralegals. Our Lawyers will travel to nearby Territories and attack or reserve the controllers for the Grey Company. This is a fairly simple task.

## Repairing Unowned Infrastructure

When we take over a room - or someone else tries to build in one of our rooms - all of a sudden their unowned infrastructure (roads, containers) get added to our list. But we only care about the ones that get us to where we need to go.

Fortunately, we already have a RoadArchitect assigned to planning out and laying construction sites for these roads. We'll just adapt it to submit repair requests as well.

# And Back to Logistics

Now that I am using more minions, it's becoming clear that my energy pipeline is sagging. My Carriers aren't keeping up with the demand of the spawner, and energy has been piling up at the sources again. Our Franchises are averaging 36 e/t (energy/tick) in, and our total output across all sinks (building, repairing, upgrading, spawning) is averaging 24 e/t, but our Storage levels have not been going up. This means we are losing fully a third of our income, somewhere.

*some time passes...*

I've spent a few days troubleshooting off and on again, fixing a few minor bugs with how requests are assigned, how reservations are handled, etc.. It's still imperfect, but we at least are maintaining a positive net income and our storage levels are steadily rising. It's good enough to move on to the next big question: thinking through strategic directives.