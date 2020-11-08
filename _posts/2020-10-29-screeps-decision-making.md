---
layout:     post
title:      "Screeps #14: Decision Making"
date:       2020-11-07 22:55:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Decision Making

Let's talk briefly about the current state. It has grown up somewhat organically as our requirements have evolved.

At a low level, TaskActions (fulfilled by minions) mostly operate as State Machines. The creep switches from the "Getting Energy" state to the "Working" state, much like in the tutorial. For some simpler actions, such as harvesting, there is only one state: doing work. Movement is part of those states (where needed), not its own state.

At a higher level, the Managers maintain a Priority Queue of tasks. The task requestors have a set of rules to define the priority for their tasks, and then the Managers fulfill them based on that relative priority.

The Office adjusts the relative emphasis of the Managers by setting their status to DISABLED, MINIMAL, NORMAL, or PRIORITY. This allows us to focus on some managers at the expense of others (when booting up a new Office, for example, Defense is often less of a priority than getting the energy pipeline flowing).

## Reflection

What's working well: the segmented units of TaskActions nicely encapsulate the reusable aspects of traveling, getting energy, etc. A state machine is a simple and logical way to handle the steps of a well-known task.

What's not: The Priority system is not translating to a clear, unified game plan. Each Manager is acting on its own initiative, rather than according to broader strategic interests. It can be difficult to get insight into why we're spawning a Lawyer to reserve a controller when we really need some Guards to clear the room first.

I'd like to see the system be more configurable. For example, I'm considering a test of abandoning remote mining on shard3 to reduce the number of active minions. But we don't currently have a RemoteMining strategy that we can enable or disable: it's just hardwired into the SalesManager.

Let's see if we can come up with a better system.

# Objectives

To improve our development and testing process, we should be able to isolate and modify or replace individual tactics or strategies. We should be able to enable or disable RemoteMining (for example).

A Strategy might affect multiple Managers: RemoteMining involves defending a room with Guards, reserving the Controller with Lawyers, building Containers with Engineers, mining the Sources with Salesmen, and hauling the energy back to the home Office with Carriers.

On a lower level, I think our state machine-based task actions are a good solution, but could be made more atomic to reduce boilerplate.

## Abstracting Tasks

The more we can abstract the implementation details from the strategy logic, the easier it will be to think through the design of our AI. For example, this would be a concise and clear way of expressing a task implementation (pseudocode, not real JS):

```
upgradeTask = Sequence(
    Selector(
        getEnergy(fromAssignedDepot),
        getEnergy(fromClosestStash)
    ),
    markController(target, 'Property of the Grey Company'),
    upgradeController(target)
)
```

A "Sequence" here represents a series of tasks to be followed one after the other until one fails, and a "Selector" represents a series of tasks to be tried until one succeeds. (I'm indebted to Millington and Funge's Artificial Intelligence for Games for the terms and concepts.) So the upgradeTask will get energy from its assigned depot, or, if that fails, from the closest supply of available energy. Then it will mark the controller (or skip the step, if that's already done), and finally use the energy it has gathered to upgrade the controller.

These steps can be broken down further:

```
moveAndMarkController = Selector(
    markController(target, 'Property of the Grey Company'),
    moveTo(target)
)
```

This will allow us to easily compose task logic in a way that's easy to interpret at a glance.

## Abstracting Office Strategies

The Managers will serve as the dividing line between office-wide Strategies and individual Tasks. Rather than assigning tasks to minions directly, Strategies will create requests. We're currently having Managers create their own requests, but delegating this to the Strategy level lets these requests be coordinated.

For example, when we're just starting an Office, we might want to create a Salesman to start harvesting energy; then enough Carriers to move all the energy it's harvesting; then another Salesman to leverage the room's second source. This is easier to represent with a centralized Strategy than by trying to adjust priorities on each of the Managers' individual requests.

I experimented with a Behavior Tree model like we used for the Tasks, but this proved to be too inflexible to work nicely for Strategies. Specifically, we needed to be able to loop over multiple items - all the Sources in an office, for example - and behavior trees don't provide a clean way to handle this.

After trying a few different patterns, I settled on something very similar to what the Managers already had. Previously, we had a Plan phase, which would analyze the state relevant to the manager and then issue requests as needed: logistics requests, to supply energy, or spawn requests, to create more minions. Then the Run phase of each manager would prioritize and execute the requests that manager was responsible for.

By separating the planning from the execution, it's easier to coordinate things across multiple managers. This is especially true for the SpawnStrategist, which no longer has to rely on bare priorities to decide what to spawn next, but can use complex logic like "if we have a surplus of energy piling up at the Franchises, and we have unfulfilled Logistics requests, spawn a Carrier."

This separation of concerns also means we can probably refactor further: most of the Managers are now doing the exact same thing, just for different kinds of work. We could condense this to a TaskManager, a LogisticsManager, and an HRManager to handle minion tasks, logistics, and spawning respectively. But this optimization doesn't bring much immediate value, so we'll hold off on this.

# Conclusions

I've spent more time than I would like getting this straightened out, and I'm fairly happy with the results. I still have some logic from the old Managers to convert to a Strategy, and then I think we will have enough of a foundation to move forward.

I would like to tackle room planning, but before I dig into it too far I should get one room to RCL8. So, it's time to scale up my private server and see how fast we can run.