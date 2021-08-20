---
layout:     post
title:      "Screeps #21: Patrolling the Perimeter"
date:       2021-08-17 17:45:00
author:     Jon Winsley
comments:   true
summary:    
categories: screeps
series: screeps
---

The article below describes the AI in its current state: I'm still expanding and refining my codebase. [Here's the GitHub repo](https://github.com/glitchassassin/screeps) if you'd like to follow along.

# Exploring Combat

Let's talk about my philosophy of Screeps combat for just a moment. It comes up often enough in Slack.

There's no taboo against combat. If you want to avoid combat so you can focus on your economy, that's fine; that's what private servers are for. If you want the risk posed by other players, that's what MMO or other public servers are for.

If you ask nicely (by [submitting a PR](https://github.com/glitchassassin/screeps)) you can be added to the Grey Company whitelist.

There *is* a taboo against providing combat code, and depending who you ask, even against discussing combat in too much detail. To that end, I'll be separating most of my combat code into a new closed-source package, leaving the rest of the codebase open-source. However, I will discuss many of the tactics, strategies, and other considerations here openly. You may implement them - or implement countermeasures - as you please.

## Defense

Clausewitz's first principle is "make your own base secure." As a reminder, here's what [our base plan looks like](https://www.jonwinsley.com/screeps/2020/11/11/screeps-room-planning/). The official Screeps docs have an [introduction to defense](https://docs.screeps.com/defense.html) which highlights two different modalities: passive (walls and ramparts) and active (towers and creeps). This is as good a place as any to start.

### Passive Barriers

The purpose of walls and ramparts is to protect your core facilities until your active defenses can destroy invaders. This could look like ramparts covering a [bunker](https://wiki.screepspl.us/index.php/Automatic_base_building#Bunker), a [min-cut generated perimeter](https://wiki.screepspl.us/index.php/Automatic_base_building#Minimum_Cut), or both. It may also include a layer of protective walls around the controller: an attacker needs to be adjacent, but your own minions can upgrade from afar, so it's a simple protection against controller attacks.

I elected to take a shortcut and use the min-cut implementation by Saruss, Chobobobo, and Shibdib [in screepers-snippets](https://github.com/screepers/screeps-snippets/blob/master/src/misc/JavaScript/minCutWallRampartsPlacement.js). Here's an example of drawing a perimeter around our extensions field and headquarters:

![A min-cut perimeter around headquarters and extensions](/assets/screeps-patrolling-perimeter-1.png)

That's a start, but there are some issues with this layout. Everything inside the perimeter is protected, but we rely on refiller minions to manage the energy levels in our extensions. If our room is under attack, the refillers need to get from the spawn (outside the perimeter) to the extensions (inside the perimeter), and they are vulnerable to hostiles.

Also, the perimeter is too close to our structures: creeps with Ranged Attack can target structures behind the ramparts. We should push the ramparts out three squares from our existing structures. That looks better:

![A better min-cut perimeter](/assets/screeps-patrolling-perimeter-2.png)

### Active Towers

Towers are the first line of defense, but without safeguards they can be exploited to drain your room's energy. If your tower code blindly attacks every hostile minion, an enemy can sit on the border, take a hit, and then blink back to the other room for healing. Repeat until the towers are drained, and then the rest of the army can charge in without fear. The same goes for minions with enough healing (or boosts) to tank those attacks directly.

So our tower code needs to be intelligent. For each hostile target, we'll calculate the damage our towers can do; then we'll calculate the healing that target can receive from itself or nearby allies, and subtract it. If the target is within three squares of an exit, or if the healing will outpace our damage, the towers will ignore it.

So far, so good; but how *do* we deal with those minions? We need active defenders.

### Active Defenders

Our ramparts will stall attackers to give us time to spawn defenders. For now we'll make it simple and spawn Guards with an equal number of move/attack parts. They'll travel to the empty rampart nearest to the target invader and attack it from cover. `ATTACK` parts make more sense here than ranged attack because they force hostile minions to stand back from the ramparts; if the hostile minion has `RANGED_ATTACK`, this will limit the damage they can do to the ramparts, so our Engineers can out-repair them, keeping them at bay indefinitely.

This will do for a start. 

### DEFCON Status

When a room is under attack, operations outside the defensive perimeter should be suspended. This particularly includes remote Franchises - Salesmen can stay put and maintain their containers, but Accountants should not try to travel past hostile minions - but also includes scouting or acquiring new offices.

Eventually we may need a more full-fledged DEFCON status. For now, we'll use our existing TerritoryIntents. The DEFEND intent will be set if there was a hostile minion in the room in the last 10 ticks. If the TerritoryIntent is DEFEND, we'll suspend spawning and hauling for remote Franchise objectives, and we'll suspend spawning for Explore and Acquire objectives.

## A Quick Break for Science

Before we get to offense, I'd like to take a detour and get some lab code implemented. Boosts are important for high-level gameplay, and the implementation will involve a few possibly-difficult concepts like scheduling spawning to align with lab availability. I'm not quite sure what this will look like yet, but it's time to stop putting it off and get it implemented.

Once that's done, we'll take our boosted creeps and say hello to our neighbors.