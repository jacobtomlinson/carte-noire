---
layout:     post
title:      How is a Web App like a Chemical Plant?
date:       2015-09-21 14:32:18
author:     Yury Voloshin
summary:    This is a reflection on the similarity between web development and chemical engineering.
categories: Rails
tags:
 - Rails
---

In the first post on this blog, I'd like to share an observation that occurred to me as I started learning about what goes on under the hood of MVC websites. I will write it from the perspective of a chemical engineer who has graduated from a web development “bootcamp” called [The Firehose Project] (http://www.thefirehoseproject.com) about six weeks ago. Hopefully, this is an observation that might give an aspiring web developer a new perspective on their work. Here it is, in a nutshell: building a reliable web application is very similar to a chemical manufacturing process. 

This seems like an obvious analogy... or is it? Let me flesh it out with details. The dictionary definition of a "process" is "a series of actions or steps taken in order to achieve a particular end." This is the reason why the manufacture of any product is usually described as a process, where the steps may be either mechanical or chemical in nature. A manufacturing process has an input (raw materials) and an output (finished product). A website's response to a user's request may also be described as a process. A [series of steps] (http://betterexplained.com/articles/intermediate-rails-understanding-models-views-and-controllers)* are set into motion by a user's HTTP request that starts with the router, moves on to the appropriate controller, and renders a display in the browser through the view component that may involve interactions with models and databases. This process also has an input (user request) and an output (the requested view). 

![Refinery](http://i.imgur.com/E72A0FX.jpg)
This is a process...

![MVC](http://i.imgur.com/o0J3Lr5.png)
And so is this.

If a process doesn't produce the expected output, then its time to troubleshoot. We can consider a chemical process where substance A is mixed with substance B in some kind of a vessel to produce a substance C. If the production rate of substance C is not what we expect, then we need to consider two main areas. First, are we sure that our knowledge of the reaction A + B → C is correct? What are the chances that, under the conditions present in the reactor, this reaction will react at a different rate than what we expect? In technical terms, this refers to “reaction kinetics”. Second, we need to consider the environment in the reactor. Is there any reason why the temperature, pressure, or the flow rate in the reactor may be different than what we expect? Deviations in either one of these areas may explain the unexpected output. 

Coming back to web development, we can also point out two main areas where errors might come from. First, we may have errors in the business logic of our application. This would be the case if the application works without crashing, but does not produce the expected result. Of course, programming errors may cause our application to crash as well. We can compare the business logic of a web app to the reaction kinetics in the world of chemical engineering. Second, the cause of an application's crash might lie in the environment. This would be the case if, for example, we're missing a required dependency, or our Vagrant VM has become inactive after not being rebooted for too long, or any one out of a large number of possible issues related to the system's configuration. Sometimes, error messages make it obvious where the problem comes from. But at other times, error messages are almost no help at all and it is up to us to figure out the source of the problem. We need to find out whether the problem is due to our programming, or the system configuration, or maybe even both. At times like these, the analogy between troubleshooting a chemical process and a web application becomes particularly relevant. 

Next, we have the safety and security concerns. In chemical manufacturing, a safe process is designed in such a way as to minimize the chances of injury for the process operators. Safeguards are designed that make it less likely for the operator to make a mistake that will damage either the product or equipment. Security considerations call for restricting access to the manufacturing site using fences, id cards, and security guards. Web development analogies are password protection and validation requirements. Security considerations also call for us to design software in such a way as to minimize attacks, such as [injection attacks and session hijacking] (http://guides.rubyonrails.org/security.html). 

Does all of this imply that a background in chemical engineering can make one a better web developer? At the risk of making this post sound like a shameless self-promotion (which it is of course), I'd like to think so. In the meantime, I'll make a note to my future reincarnated self to become a developer without having first been a chemical engineer. Then, we'll be able to answer this question with certainty.
________________________________________
*Thank you [Christina McIntyre](http://www.christinamcintyre.com) for the [MVC link](http://betterexplained.com/articles/intermediate-rails-understanding-models-views-and-controllers)!
