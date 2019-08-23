---
layout:     post
title:      Cucumber and TestCafe in Parallel
date:       2019-07-22 16:00:00
author:     Jon Winsley
comments:   true
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

Cucumber has the ability to run tests in parallel, in theory, but since I'm mixing in TestCafe things aren't quite so easy.

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

Those iterations, of course, are per-process. That means each slave process is starting at the same port. So we need some other way to avoid conflicts. Luckily, Node makes it easy: if you don't specify a port number, you'll be assigned a random available port! Since we don't need to address this port again, we don't particularly care what it is, so we can remove those ports altogether.

However, the `test.js` file we write to hook the TestCafe test controller is another point of conflict: the process creates it at the beginning of each feature and then destroys it at the end. When you have multiple slave processes, it's all too easy for one to get rid of the file right when another process is trying to reference it. 

It's safest to have a separate file per process. Cucumber provides an environment variable CUCUMBER_SLAVE_ID that identifies each process, so we can just prepend that to `_test.js` for a process-unique filename:

    .src(`./${process.env.CUCUMBER_SLAVE_ID}_test.js`)

Repeat the change for any other references to `test.js`, of course.

## Application Lag

After getting tests to run in parallel, I still had some kinks to work out. For one thing, my application's services were slower to respond than usual: the dev ring has limited resources, and hitting it with several requests at once was causing it to take longer than three seconds to respond. 

The timeout was being thrown by TestCafe, so we just need to specify a different timeout in the run method above:

    .run({
        selectorTimeout: 30*1000, // 30 seconds
        assertionTimeout: 30*1000
    })

You'll also need to check the Cucumber global timeout value, defined in hooks.js:

    const {AfterAll, setDefaultTimeout, Before, After, Status} = require('cucumber');
    const errorHandling = require('../support/errorHandling');
    const TIMEOUT = 30*1000;
    [...]
    setDefaultTimeout(TIMEOUT);

## Remaining Instability

After all this work, I'm still seeing crashes occasionally from TestCafe if I try to run more than two parallel processes. In the first case, it just hangs up when the Before hook tries to launch TestCafe - a browser opens, but it never hooks the controller back to Cucumber.

In the second case, I get an error message like the following:

    [Error: EBUSY: resource busy or locked, unlink 'C:\Users\jwinsl01\AppData\Local\Temp\1\testcafe\chrome-profile-8208bnrVaCerIQZV\Safe Browsing Cookies'] {
      errno: -4082,
      code: 'EBUSY',
      syscall: 'unlink',
      path: 'C:\\Users\\jwinsl01\\AppData\\Local\\Temp\\1\\testcafe\\chrome-profile-8208bnrVaCerIQZV\\Safe ' +
        'Browsing Cookies'
    }

It looks like TestCafe is having trouble cleaning up its temporary Chrome profile, but these temporary profiles are generated with a random string, so they should be unique to each feature. 

I haven't yet been able to identify a reason for these errors, but when they do happen, they cause the scenario to show as "undefined" in the test results. There's an [issue open on GitHub](https://github.com/rquellh/testcafe-cucumber/issues/27) to figure out the problem, but in the meantime, I do have a workaround.

## Rerunning Cucumber Features

Cucumber.js lets us dump failed tests to a `@rerun.txt` file, so we can quickly re-run those tests that failed in parallel. For the sake of making sure they actually work this time, I've set my package.json actions up to re-run these tests sequentially:

     "scripts": {
         "cucumber": "del reports\\*.json && cucumber-js -f rerun:@rerun.txt -f progress-bar -f json:reports/cucumber_report.json --parallel=5",
         "cucumber:rerun": "cucumber-js @rerun.txt -f progress-bar -f json:reports/cucumber_report_rerun.json",
         "report": "node report.js",
         "test": "npm-run-all -c cucumber cucumber:rerun report"
       },

The rerun option is just a custom formatter that outputs the file & line number of failed scenarios to `@rerun.txt`. Cucumber then reads that file (the `@` at the start is important) and launches just those specific scenarios.

As you can see, I have sub-steps for running all scenarios in parallel; rerunning failed scenarios sequentially; and generating an HTML report (from [cucumber-html-reporter](https://github.com/gkushang/cucumber-html-reporter)). Then I'm using npm-run-all as an easy way to run each one (the -c flag tells it to run them all, even if one step fails, as tests often will.)

## Whew.

That's a lot, and it isn't all pretty. Know how to make it better? Let me know on Twitter!
