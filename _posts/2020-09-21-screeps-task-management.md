---
layout:     post
title:      "Screeps #2: Task Management"
date:       2020-09-21 17:00:00
author:     Jon Winsley
comments:   true
summary:    The dark arts of task management as implemented for a Screeps AI
categories: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Task Management

How do you make sure your minions are doing the work that most needs done?

First we need to track the work that needs done. We'll call those Requests. The Task Supervisor will collect these as they come in.

Then we need to collect the minions that are idle. Since the Task Supervisor handles all work being done, we'll just look for all of our minions and cross off any that are currently busy with something else.

Now we need to figure out which minion is best suited to fulfill which request. Buckle up; this is going to be a long post!

## Predicting Task Fulfillment

This gets difficult when you consider that there could be more than one way to fulfill a request. Let's say that the Spawn needs energy. You could send a minion to a Source, have it harvest the energy, then send it to the Spawn to transfer it; or, you could send a minion to a Container, have it withdraw the energy, and then send it to the Spawn to transfer it.

We'll worry about optimization later; for now, let's consider each possible path, and figure out the best way for a given minion to fulfill a given request.

Well, okay, one optimization: *can* a minion fulfill a request? A hauler minion, for example, can't fulfill a Build request because it doesn't have any WORK parts! On the other hand, an empty hauler can't currently fulfill a Transfer request, but it might if it stopped to fill up on energy first.

So let's start breaking this up conceptually:

```
class TaskRequest {
    task: TaskAction;
    status: "PENDING"|"INPROCESS"|"COMPLETE";
}
class TaskAction {
    prereqs: TaskPrerequisite[];
    action: (creep: Creep) => boolean; // Action complete?
}
class TaskPrerequisite {
    meets: (creep: Creep) => boolean; // Does minion meet prerequisite?
    toMeet: (creep: Creep) => TaskAction[]; // What would it take for minion to meet prerequisite?
}
```

Now, we can start to put our logic together. Each kind of task will be an extension of TaskAction, and will have its own prerequisites:

```
class BuildAction extends TaskAction {
    site: ConstructionSite;
    prereqs: [
        new MinionCanWork(),
        new MinionHasEnergy(),
        new MinionIsNear(this.site.pos, 3)
    ];
    action = (creep: Creep) => {
        if (creep.build(this.site) !== OK) {
            return true; // Unable to build, end task
        }
        return false; // Task is not complete
    }
}
```

Now, some of those prerequisites cannot be met. A minion with no work parts cannot add more work parts to fulfill this request. But a minion with no energy can travel to find some energy. So if the prerequisite toMeet() returns an empty array, we can skip on ahead to the next minion.

```
class MinionCanWork() {
    meets: (creep: Creep) => (creep.getActiveBodyparts(WORK) > 0)
    toMeet: () => []; // No way to meet
}
class MinionHasEnergy() {
    meets: (creep: Creep) => (minion.capacityUsed > 0)
    toMeet: (creep: Creep) => {
        if (minion.capacity === 0) return []; // Minion cannot carry
        return global.analysts.source.getContainers(minion.creep.room)
                                     .map(source => new WithdrawAction(source));
    }
}
```

This is the beginning of a task tree! If the minion doesn't currently have energy, then the prerequisite returns a task that it could do to get energy. That task might have its own prerequisites - must be able to carry energy, must be adjacent to the container - which might in turn have their own tasks. Once we get to a task which has no prerequisites, or the minion meets all of its prerequisites, we have a complete list of TaskActions that will result in fulfilling the request.

Now we can generate all the possible paths to fulfill the request. How do we decide which path is best? We'll have to extend our TaskActions:

```
class MoveAction extends TaskAction {
    destination: RoomPosition;
    prereqs: [
        new MinionCanMove(),
    ];
    action = (creep: Creep) => {
        let result = creep.moveTo(this.destination);
        if (result === ERR_NO_PATH ||
            result === ERR_NOT_OWNER ||
            result === ERR_NO_BODYPART ||
            result === ERR_INVALID_TARGET) return true; // Unrecoverable error
        return creep.pos.inRangeTo(this.destination, this.distance);
    }
    cost = (creep: Creep) => {
        creep.pos.getRangeTo(this.destination);
    }
}
```

The `cost` method lets us predict approximately how much the action will cost (in ticks). In this case, we're approximating with range, because doing the actual pathfinding gets expensive fast. We can tune this cost later: it should also factor in the creep's effective move speed, for example. But for now this will do.

So, now that we have a path, we just have to call the `cost` for each Action in the path and add them up to find the total. Well... almost.

We're calculating the cost based on the minion doing the action. But while we're calculating, the minion isn't moving. So the cost for the minion to move to the Build Site right now will be different from its cost to move to the Build Site after it collects energy from a container.

That's okay; we'll create a SpeculativeMinion that predicts the minion's state along the task path and use that to calculate the cost. Each Task will update the SpeculativeMinion with its predicted outcome: a HarvestAction will increase the SpeculativeMinion's capacityUsed, while a MoveAction will change the SpeculativeMinion's position. Then the cost function can calculate accurately based on the minion's predicted state.

Whew! We now have a TaskPath and we know long it will take the minion to perform it. While we're at it, we can also get the SpeculativeMinion's predicted output: a hauler with 100 capacity will be able to transfer twice as much as one with 50 capacity.

This makes picking the best TaskPath for the minion easy. But we're not done yet.

## Stable Marriages of Minions and Requests

Let's say we have two TransferAction requests from containers A and B. We have two idle minions, and the best paths have been calculated for both:

```
TransferAction A - Minion 1: 20 ticks
TransferAction A - Minion 2: 25 ticks
TransferAction B - Minion 1: 10 ticks
TransferAction B - Minion 2: 35 ticks
```

As things stand now, we'll loop through our list of requests. TransferAction A will pick minion 1, because that's its best option. But that means B is stuck with Minion 2, which is far more expensive! We need a better way to balance these requests.

Fortunately, the Gale-Shapley stable marriage algorithm exists to meet this need. I was tipped off to it by Ben Bartlett's [article on Screeps logistics](https://bencbartlett.wordpress.com/2018/03/28/screeps-4-hauling-is-np-hard/), which goes into realms of mathematical wizardry that frighten even me. Nonetheless, I got the basic principle of it, and with some effort was able to make it work.

The idea is that given two lists - in our case, the TaskActions and the Minions - we should be able to create pairs, such that no un-paired TaskAction and Minion prefer each other to their current partners.

Going back to our example, TransferAction B prefers Minion1 over Minion2 (because it's cheaper), and Minion1 prefers TransferAction B over A (for the same reason). So our naive approach failed.

The Gale-Shapley algorithm works like this:

We start with the list of Actions.

* TransferAction A gets its first pick: Minion 1, which is the cheapest. Minion 1 tentatively accepts the task, and A is out of the list.
* TransferAction B gets to pick second: It goes to Minion 1, even though A already offered Minion 1 a task. Minion 1 likes B's task better, and so A gets shoved back into the list and B is out.
* Back to the top of the list, A goes to its second pick: Minion 2. Minion 2 has no other offers, so it accepts.

Now we have A paired with Minion 2 and B paired with Minion 1. Much better!

## Further improvements

Let's say that Spawn needs 200 energy, and we have two idle haulers with a capacity of 100 each. Spawn generates an energy request: which hauler should fill it? Ideally, both! But our current system assigns one Minion per Request. To assign multiple minions, we need to track the Request's capacity and the output of the assigned Tasks. If the Request's capacity is not met, there is room for an additional minion; otherwise, we'll skip it when assigning Requests.

# Closing Comments

This Task system still has limitations. It doesn't consider multiple steps - collecting energy from multiple containers to fill a hauler, for example. And it's not very efficient to calculate the whole tree of fulfillment possibilities: once it has a viable path of known length, it should be smart enough to stop checking longer paths.

Even when optimized, this generic route seems slow and CPU-intensive. Managers should try to limit requests, either by issuing tasks to minions directly if the task is well understood or by sending only the highest priority requests.