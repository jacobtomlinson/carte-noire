---
layout:     post
title:      Mixing Cucumber and TestCafe
date:       2019-07-15 16:30:00
author:     Jon Winsley
summary:    Exploring the code needed to bind Cucumber and TestCafe into a cohesive unit
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

## Extending Cucumber

Our goal is to keep the Gherkin syntax, and hence the Cucumber step definitions. To leverage
TestCafe, then, we need to inject the TestCafe test controller object into the context of each
step definition. This is accomplished with [hooks](https://github.com/cucumber/cucumber-js/blob/master/docs/support_files/hooks.md).

rquellh's solution stands up a TestCafe controller with the `Before` hook, which (as you might
guess) runs before each Cucumber test. It generates a dummy file, `test.js`, which TestCafe 
reads as the source of the tests.

    Before(function() {
        runTest(n, this.setBrowser());
        createTestFile();
        n += 2;
        return this.waitForTestController.then(function(testController) {
            return testController.maximizeWindow();
        });
    });
[\[src\]](https://github.com/rquellh/testcafe-cucumber/blob/master/features/support/hooks.js#L45)

The `test.js` file reads as a TestCafe test file, complete with fixtures, but rather than
executing a test it captures the TestCafe controller and passes it back to testControllerHolder
once it's set up. The waitForTestController promise object waits for TestCafe to finish setting
up the controller asynchronously, then adds it to [Cucumber's world scope](https://github.com/cucumber/cucumber-js/blob/master/docs/support_files/world.md) 
as `testController`. The `Before` hook also maximizes the test controller window, once it's ready.

    this.waitForTestController = testControllerHolder.get()
            .then(function(tc) {
                return testController = tc;
            });
[\[src\]](https://github.com/rquellh/testcafe-cucumber/blob/master/features/support/world.js#L7)

**Note:** The testController declaration isn't directly attached to the World object; it's just 
implicitly declared, which means it's in the global scope. This hasn't been a problem for my 
tests so far, but be aware of potential for clashes if, for some reason, you have 
similarly-named global variables.

## Initializing TestCafe

Let's take a step back and look more closely at the TestCafe setup. What's going on here?

     function runTest(iteration, browser) {
         createTestCafe('localhost', 1338 + iteration, 1339 + iteration)
             .then(function(tc) {
                 cafeRunner = tc;
                 const runner = tc.createRunner();
                 return runner
                     .src('./test.js')
                     .screenshots('reports/screenshots/', true)
                     .browsers(browser)
                     .run()
                     .catch(function(error) {
                         console.error(error);
                     });
             })
             .then(function(report) {
             });
     }
[\[src\]](https://github.com/rquellh/testcafe-cucumber/blob/master/features/support/hooks.js#L24)

First off, note the `iteration` variable. This is designed to ensure tests execute correctly,
even in parallel: if Cucumber launches multiple tests concurrently, each one's TestCafe
instance will be set up on its own port. These begin at 1338, and for each new test `iteration`
is incremented by two.

Aside from that, the rest of this is pretty self-explanatory: use the `test.js` file (which
makes sure the TestCafe controller gets back to Cucumber's world scope); save screenshots to
the specified folder; use the given browser; and do nothing with the generated report. (We'll
be reporting through Cucumber instead.)

The test file is similarly straightforward:

    function createTestFile() {
        fs.writeFileSync('test.js',
            'import errorHandling from "./features/support/errorHandling.js";\n' +
            'import testControllerHolder from "./features/support/testControllerHolder.js";\n\n' +
    
            'fixture("fixture")\n' +
    
            'test\n' +
            '("test", testControllerHolder.capture)')
    }
[\[src\]](https://github.com/rquellh/testcafe-cucumber/blob/master/features/support/hooks.js#L13)

It sets up a simple TestCafe fixture, where the only "test" is calling the testControllerHolder
capture method. This passes in the test controller, which responds with a Promise, to be
resolved when the Cucumber script finishes and calls `testControllerHolder.free()`. Until then,
the TestCafe script waits in the background, letting us use the test controller to our heart's
content.

## Usage Example

So what does this look like in practice? Simple: Copy the `feature/support` folder to your own
`feature` directory. Write up your feature file exactly as you would with Cucumber. Then, in
your step definitions, you can import `Selector` from TestCafe to target elements on the page.

Because the TestCafe test controller uses asynchronous calls, you'll need to specify that your
step functions are async. Then just start writing with TestCafe:

    const {Given, When, Then} = require('cucumber');
    const Selector = require('testcafe').Selector;
    
    Given('I am open Google\'s search page', async function() {
        await testController.navigateTo('https://google.com');
    });
    
    When('I am typing my search request {string} on Google', async function(text) {
        var input = Selector('.gLFyf').with({boundTestRun: testController});
        await this.addScreenshotToReport();
        await testController.typeText(input, text);
    });
    
    Then('I press the {string} key on Google', async function(text) {
        await testController.pressKey(text);
    });
    
    Then('I should see that the first Google\'s result is {string}', async function(text) {
        var firstLink = Selector('#rso').find('a').with({boundTestRun: testController});
        await testController.expect(firstLink.innerText).contains(text);
    });
[\[src\]](https://github.com/rquellh/testcafe-cucumber/blob/master/features/step_definitions/google.js#L1)

I've found that, in many cases, Selector will just work without the `with` context: the
testController is smart enough to figure out what you mean for the purposes of clicking or
typing on an element. For assertions, however, the `.with({boundTestRun: testController})`
binding is inescapable, and TestCafe will throw an error like the following:

    Selector cannot implicitly resolve the test run in context of which it should be executed. 
    If you need to call Selector from the Node.js API callback, pass the test controller 
    manually via Selector's `.with({ boundTestRun: testController })` method first. Note that 
    you cannot execute Selector outside the test code.

As a workaround, you can create a wrapper for Selector that does this automatically. Because
testController is a global variable, we can access it from here without additional work. I
saved this to `features/support/selector.js`:

    const { Selector } = require('testcafe');
    
    function select(selector) {
        return Selector(selector).with({boundTestRun: testController});
    }
    
    exports.Selector = select

Then you can import the wrapped Selector into your step definitions:

    const { Selector } = require('../support/selector');

Voila! Now we can get rid of the extra `with()` clutter in the example above.

    const {Given, When, Then} = require('cucumber');
    const { Selector } = require('../support/selector');
    
    [...]
    
    When('I am typing my search request {string} on Google', async function(text) {
        var input = Selector('.gLFyf');
        await this.addScreenshotToReport();
        await testController.typeText(input, text);
    });
    
    [...]

What issues have you run into with integrating Cucumber and TestCafe? Let me know 
[on Twitter!](https://twitter.com/jonwinsley)
