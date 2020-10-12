---
layout:     post
title:      "Screeps #10: Questioning Everything"
date:       2020-10-12 14:00:00
author:     Jon Winsley
comments:   true
summary:    In which we look back over our progress so far and evaluate what has worked and what needs improvement.
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Current State

![Profile screenshot showing GCL2](/assets/screeps-10-8-status.png)

We have reached GCL2 and have one room at RCL6. The Grey Company is currently franchising in two adjacent territories. Our Salesmen are effectively tapping out the sources in all three rooms, but the energy is piling up there and not being moved anywhere useful:

![Sales report from active franchises](/assets/screeps-10-8-sales.png)

Our fleet of Carriers is averaging about 85% capacity (85% full, 15% empty). This seems high: given the simple example of one Storage and one Source, the Carriers should be averaging 50% capacity (full from Source -> Storage, empty from Storage -> Source).

Meanwhile, our overall outputs (spawning, upgrading, building, repairing) have been comparatively low, averaging 15.5 energy/tick compared to the 40 energy/tick input from all Franchises.

## Diagnostics

Some of this is due to poor output scaling: we are not currently scaling up building or upgrading when we have an energy surplus. But we do have a standing order for Storage that should be catching the excess energy. Matters are complicated further by the TaskManager assigning several minions to fulfill a request that only needs one! The Extensions are all requesting energy, and the Carriers are getting caught up filling them rather than hauling energy from remote Franchises.

It seems our flexible request system may be causing more trouble than it's worth. We've already taken steps to simplify non-logistics tasks, but perhaps it's time to consider other approaches.

# Rethinking Logistics

Discussions in Slack led me to a couple of conclusions. First, I think the main issue with my current approach is in handling requests one at a time: when I get twenty requests for extensions to be refilled, it retasks twenty Carriers, even though one full 1000-capacity Carrier could refill them all. But while we're refactoring, there's another approach I'd like to consider: the carrier/distributor model.

The Direct Delivery model is what we currently use: a Carrier picks up energy from a Source or Storage, then travels to fulfill energy requests.

The Distributor model has a dedicated Carrier route from a Source to a centralized Storage or energy depot. Then Distributor minions fulfill energy requests from that depot.

The Direct Delivery model has some advantages: routing energy directly from the source to its destination costs less and takes less time overall than routing energy to a central storage location and then to its destination. However, a Distributor model would fulfill incidental requests more quickly, as the Distributor has less distance to travel. This is especially important to maintain extension energy levels.

But I think we get the best of both worlds by taking the Direct Delivery model and treating the Storage cache as another (perhaps closer) Source. Then the only loop we need to watch out for is withdrawing from storage -> looking for tasks -> no tasks -> depositing surplus in storage. This allows fulfillment of close requests (extensions) from Storage, if a local Carrier is available.

## Logistics Logic

The loop will then look something like this:

1. If Carrier is not executing a Route, create one.
  - Select the top priority request with the shortest path from Carrier -> Source -> Request. (Prefer the closest source that can completely fill the Carrier, then the closest source that can fulfill the request capacity, then the closest source. If the Request is to resupply a Cache, then ignore that Cache in the list of sources.)
  - Carrier's Capacity for this Route is the minimum of its carrying capacity and the source's available resources
  - If Carrier still has capacity after fulfilling the request, select the top priority request that is closest the previous request. (If the Route's Source is a cache, ignore requests to resupply the cache.)
  - Repeat until Carrier has no remaining capacity.
2. Place a reservation for the energy from the Source.
3. Follow the Route.

This solves the issue we had previously with assigning too many Carriers to small tasks, and the Reservations will help limit fighting over the closest (but nearly empty) Source.

## New Task Logic

Since we're breaking out logistics entirely, much of our existing task system becomes irrelevant. We're left with simple tasks like building, repairing, upgrading, and exploring. But we're already locking some of our minions down to their specialties: Salesmen and Carriers have specific builds. Lawyers and Engineers both require WORK parts, but Lawyers rarely need to move quickly, so we can save on their MOVE parts. Engineers do need to get around to construction sites across our territories.

So if we're shifting towards optimizing minions by role, it doesn't make a lot of sense to have a single shared task system with all the requests. Instead, we'll let each manager arrange tasks for its own minions. But the code for handling tasks and assignments can be shared between the different managers: we'll create a common OfficeTaskManager class from which these task-managing managers can inherit the behavior.

## Depot Logic

Because I'm still irrationally obsessed with good startup code - and because I suspect depots will be relevant for some time after - let's revisit our mobile depots a bit too. These function just like any other Logistics request, with the exception that they are always the endpoint of a route: no other requests are accepted. Since depots really have no time constraint, this prevents requests from being accepted and then backlogged indefinitely. Then the requestor of the depot (FacilitiesManager, for example) is responsible to track when the depot is no longer needed and cancel the request (if the builder minion dies early, perhaps).

We could do some optimization in the future to "back-fill" a short route that ends below capacity at a Depot, but in most cases the Depot request's capacity will be more than a single Carrier can manage anyway, so we should not lose too much efficiency here.

A larger concern might be scaling the Depot request's effective throughput. If we have a single relatively close builder minion, it doesn't make sense to dedicate five Carriers to the construction site's Depot. We really only need enough on site to keep the builder supplied: other carriers can be fulfilling other requests, or (when the depot is running low) set off to replace the current Carrier.

# Conclusions

Refills run much more smoothly now. Logistics requests are being handled more effectively, and it's time to start thinking about how to scale up our Builder and Upgrader minions to take advantage of the increased throughput.