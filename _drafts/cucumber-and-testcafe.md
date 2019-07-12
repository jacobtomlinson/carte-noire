---
layout:     post
title:      Extracting Reports from a Legacy EMR
date:       2019-07-12 16:30:00
author:     Jon Winsley
summary:    Mixing Cucumber and TestCafe
categories: testing
tags:
 - automation
 - testing
 - web development
---

## Cucumber

[Cucumber](https://cucumber.io/) is known for its emphasis on writing human-readable tests, to facilitate 
communication between the users, developers, and QA team. You might not even realize
at a glance that you're looking at code. To borrow an example from [the official tutorial:](https://cucumber.io/docs/guides/10-minute-tutorial/)

    Feature: Is it Friday yet?
      Everybody wants to know when it's Friday
    
      Scenario: Sunday isn't Friday
        Given today is Sunday
        When I ask whether it's Friday yet
        Then I should be told "Nope"

This puts the emphasis on sitting down with the users and developers ahead of time,
and enshrines the goals and requirements for the system in a common language. Both
users and developers will be able to take away a descriptive checklist of how the
system should operate, once it's built - and, with Cucumber, we can turn that into a
repeatable test script that can be integrated with our build process.

Cucumber scripts can be written with a handful of different languages, including Node.js.

 ## TestCafe
 
 [TestCafe](https://github.com/DevExpress/testcafe) is an end-to-end web testing tool 
 that runs on Node.js. It provides a non-WebDriver-dependent solution for automating web
 applications and making assertions about application state. The syntax is very slick and
 easy to dive right into (again, borrowing from [the official readme](https://github.com/DevExpress/testcafe#getting-started)):
 
     import { Selector } from 'testcafe'; // first import testcafe selectors
     
     fixture `Getting Started`// declare the fixture
         .page `https://devexpress.github.io/testcafe/example`;  // specify the start page
     
     
     //then create a test and place your code there
     test('My first test', async t => {
         await t
             .typeText('#developer-name', 'John Smith')
             .click('#submit-button')
     
             // Use the assertion to check if the actual header text is equal to the expected one
             .expect(Selector('#article-header').innerText).eql('Thank you, John Smith!');
     });
 
The power of TestCafe and the readability of Cucumber's Gherkin syntax make these two
packages a natural match. How difficult is it to combine the two? Not very, as it turns
out; most of the work has [already been done](https://github.com/rquellh/testcafe-cucumber) for us. 

## Integrating TestCafe and Cucumber

Our goal, then, is to write Features a la Cucumber and flesh out the step definitions with
TestCafe's powerful scripting engine. There are plans to integrate Gherkin directly into
TestCafe, but until that happens, [rquellh](https://github.com/rquellh/) has the authoritative
solution in the [testcafe-cucumber](https://github.com/rquellh/testcafe-cucumber) repository.
Let's dig into how it works.

