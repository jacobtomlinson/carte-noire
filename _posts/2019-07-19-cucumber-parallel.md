---
layout:     post
title:      Cucumber in Parallel
date:       2019-07-19 16:30:00
author:     Jon Winsley
summary:    More adventures coercing Cucumber and TestCafe into playing nicely - in parallel this time!
categories: testing
tags:
 - automation
 - testing
 - web development
 - cucumber
 - testcafe
---

So after [getting Cucumber and TestCafe](https://www.jonwinsley.com/testing/2019/07/15/cucumber-and-testcafe/) hooked up to write features in Gherkin and step definitions in TestCafe, I started hashing out a stack of features to check field validation in a user interface project. I ended up with a lot, and each was re-running with [Scenario Examples](https://cucumber.io/docs/gherkin/reference/#example), which adds up to quite a bit of runtime.

Cucumber has the ability to run tests in parallel, in theory, but since I'm using TestCafe as well things aren't quite so easy.

## Multiple TestCafe Services

The first barrier we immediately run into is port allocation for TestCafe in each of the slave instances. You may recall how we initialized the test controller:


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

Those iterations, of course, are per-process. That means each slave process is starting at 0. So we need some other way to avoid conflicts. Luckily, Node makes it easy: if you specify a port number of 0, you'll be assigned a random available port! Since we don't need to address this port again, we don't particularly care what it is, so we can replace those ports altogether.

However, the `test.js` file we write to hook the TestCafe test controller is another point of conflict: the process creates it at the beginning of each feature and then destroys it at the end. When you have multiple slave processes, it's all too easy for one to get rid of the file right when another process is trying to reference it. It's safest to have a separate file per process.

Luckily, Cucumber provides an environment variable CUCUMBER_SLAVE_ID that identifies each process, so we can just prepend that to `_test.js`:

    .src(`./${process.env.CUCUMBER_SLAVE_ID}_test.js`)

Repeat the change for any other references to `test.js`, of course.

## Application Lag

After getting tests to run in parallel, I still had some kinks to work out. For one thing, my application's services were slower to respond than usual: the dev ring has limited resources, and hitting it with several requests at once was causing it to take longer than three seconds to respond. 

The timeout was being thrown by TestCafe, so we just need to specify a different timeout in the run method above:

    .run({
        selectorTimeout: 30*1000, // 30 seconds
        assertionTimeout: 30*1000
    })

Now, if you happen to have a test step that (for whatever reason) runs for longer than 20 seconds, you'll see a different crash from Cucumber:
