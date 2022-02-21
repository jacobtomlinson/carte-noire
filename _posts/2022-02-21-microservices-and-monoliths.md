---
layout:     post
title:      "Microservices and Monoliths"
date:       2022-02-21 00:00:00
author:     Jon Winsley
comments:   true
summary:    "Microservices are the new wave of application architecture, but are they right for every project?"
---

The concept of microservice architecture has been around for several years, offering to relieve many of the pain points of massive monolithic applications. Yet companies still struggle to understand and implement microservices well. Are microservices a panacea, the default choice for every application? Are they just an over-hyped buzzword? Do they introduce more problems than they solve?

[All right, let's outline...]

1. Definition of Microservices vs. Monoliths
2. Monolith Pain Points (What Microservices Do Well)
3. Doing Microservices Badly

## Microservices and Monoliths

Some of the confusion comes from uncertainty about what these words mean. What is a "microservice"? What differentiates it from a "monolith"?

### Monoliths

"Monolith" comes from the root words "mono," meaning "one," and "litho," meaning "stone." A monolith, then, is a single stone - a single, self-contained, cohesive unit. Our monolith application is designed to work when it's complete, and would be broken if some parts were missing.

Consider a blog application as a simple example. We might have a static frontend, a backend API to handle authorization or other functionality, and a database to store information about posts, comments, and users. This application - frontend, API, and database together - is a tightly-coupled single unit.

And, for a blog, this is probably fine.

### Microservices are Mini-Monoliths

A single massive block of stone can be hard to work with. Transporting something that heavy requires feats of engineering and a lot of people to help. It's far easier to cut smaller blocks of stone and stack them together to create one large structure.

Microservices are a bit like those building blocks. They can be supported by smaller teams, and they can be moved to production with less engineering effort. But each microservice is still a single stone: a single, self-contained, cohesive unit. Sometimes these microservices are just the API and database together, but [micro frontends](https://micro-frontends.org/) are a growing trend too.

Those stone blocks still have to fit together to build the entire structure, so those microservices have defined *interfaces*. This makes microservices "loosely coupled." As long as its API stays the same, a microservice can completely change its internal language, database, etc. without affecting any of the other services.

Each of these microservices is a specialized component of the whole. A monolith might already have specialized modules to handle different domains of the application - in our example above, we might have modules for users, posts, and comments. That modular thinking generally translates well to a microservice architecture.

Now let's consider an example that is *not* a microservice architecture.

Suppose we take our blog application and split up the backend services. We now have backend services for Users, Posts, and Comments. Each of those backend services may reference any table in the shared database. Are these microservices?

They are not! Because of the data layer, those services are still tightly coupled. If the Posts service depends on the table with user data, the Users service can't make changes without potentially breaking the Users service. This is more modular, with some advantages over a pure monolith - you can scale those backend services independently, for example, depending on load - but it's not a microservice architecture.

## Problem Solving with Microservices

Monoliths are a solid architecture for certain applications - after all, microservices are themselves just smaller, more specialized monoliths. But as an application grows, monoliths can become unwieldy, and a few problems arise.

It becomes difficult to build, test, and deploy the entire application. Agile development calls for rapid iteration, but a massive, tightly-coupled monolith makes this difficult and risky. Changes in one part of the application may impact others, and testing thoroughly is difficult and time-consuming. Loosely-coupled microservices make it easier to build, test, and deploy independently, without affecting the rest of the application.

It's also difficult to grow the team managing the application. The larger the monolith grows, the more there is to teach when onboarding new developers. There are more opportunities to step on each others' toes while working on related parts of the codebase. Microservices make it easier to assign small teams to master a specific domain of the application.

## Causing Problems with Microservices

When should you *avoid* microservices? Is a monolith ever the right architecture?

Microservices are not, unfortunately, a panacea. Splitting an application into microservices increases complexity, and makes it harder to visualize and understand the full architecture. You may need different infrastructure or an orchestration platform to run microservices. Managing scaling, monitoring, and data security across multiple services can add further challenges.

But if those are already solved problems, or outweighed by the unwieldiness of your monolith, microservices may just be the right architecture for you.