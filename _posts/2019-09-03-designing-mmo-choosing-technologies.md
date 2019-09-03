---
layout:     post
title:      Designing an MMO - Choosing Technologies
date:       2019-09-03 12:15:00
author:     Jon Winsley
comments:   true
summary:    If you're going to build an MMO from scratch, where do you start?
categories: gamedev
tags:
 - game development
 - software design
---

It's pretty easy to arbitrarily declare "I'm going to use THIS popular toolkit to build my game!" But game development isn't a one-size-fits-all endeavor. Let's talk through the requirements of our game and, from there, discuss specifics.

## Requirements

Whenever you start a software design project, the first question to ask is "What are the requirements?" Who is going to be running this software, on what kind of platforms? What kind of functionality does it need to have?

You won't know all the answers up front, and that's okay. We'll be coming up with new requirements until we ship the game (and even after). So let's just look at the requirements that lay out the broad shape of our game.

## Playstyle

The core gameplay loop of Uplink doesn't need a graphics engine; the game is played in a series of windows, like any computer application. We can create a suitably cyberpunk UI in a web app. As a bonus, this means we can lean more heavily on UI design (which I'm good at) than art (which I'm not). So, that's what we're going to do!

We'll build the front-end client with SVG elements (to allow custom shapes for menus, buttons, etc). We'll use a Javascript front-end framework to bring the pieces together.

To make this multiplayer, we'll need to think about our back-end architecture as well. The core difference between an MMO and a multiplayer-lobby game is the shared world: Everyone else in the game is in the same world you are, and their actions are a) persistent and b) affect your experience.

So, we'll need to maintain simultaneous connections from a number of connected clients; update and fetch the game state; and persist the state, so we don't lose the world if the game servers get restarted.

Speaking of connections, there are a couple different technologies to keep a Javascript client connected with a background server. For real-time gaming purposes, websockets are far and away the best option, so it's hardly worth comparing them to server-sent events or long polling (but feel free to explore on your own if you're curious). 

## Technologies

Let's start with the front end. There are a few good candidates for a Javascript front-end framework, including Angular, React, and Vue. For our purposes, any of these should work; personally, I like React, so we're going to use that.

With React naturally comes Redux for state management. The client state is going to be a subset of the server state. The concept of Redux actions makes it easy to define a common language: the client sends an action to the server to tell it what it wants to do, and the server sends actions to the client to a) confirm its request or b) let it know what other players are doing.

I don't know if we'll stick with Redux on the back end in the long term, but if we do eventually replace it with something better suited to a distributed architecture we can most likely keep the same language of actions to represent state changes.

So, for now, let's use Redux on the server too. It's an unusual case, because most web applications don't want to maintain state on the server side, but that's exactly what we want for this project.

That leads us, naturally, to adopt Node.js as the language for our server build. A shared language between front end and back end also makes it easier to extract the game logic into a module that can be shared with both. (We'll get into this a bit later!)

I took a brief look at existing game servers for Node, but the major ones seem focused specifically on multiplayer-lobby games. That's okay. Our use case is different enough from most other multiplayer games - we aren't tracking real-time positions on a 2D or 3D map - that any existing server implementation would be an imperfect fit. 

## Conclusions

We've decided to use Node.js on the back end, React on the front end, websockets to communicate, and Redux on both to share state. We haven't even filled in the details of the game yet, but we already have enough to start setting up our dev environment!

Next up, let's start looking at that environment, and talk in a little more detail about how we're going to architect the back-end services.
