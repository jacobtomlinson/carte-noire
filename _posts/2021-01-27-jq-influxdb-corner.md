---
layout:     post
title:      
date:       2021-01-27 13:37:25
summary:    
categories: influxdb
thumbnail: imageit
tags:
 - inflxdb
 - jq
 - jquery
 - grafana
---


I received what I thought was a simple question from the DBA's.


"That one really big measurement. How big is it compared to the rest of the db?"


This seemed like an easy question.

Simple enough to query out my "big thing".


The pain came when I tried to measure "the rest".


Or even "all of it".

---

For the "Big thing", it seemed like I could use:

` select(*) from db.rp.big_measurement`

While it really seems like the following would give a comparison point:

` select(*) from db.rp.* ... `

...


But this does not return a simple answer.

We aren't asking "what is the total count";

Instead we are asking "What is the count for each field in each measurement"

...

I expected a single number and got a 3.6MB response...

It's a printout of my of my schema.

Useful, but not my answer.

What I want is:

Per measurement, count of points.


But what is a point?

- a single field?
- a point in time?

Due to underlying idiosyncrasies of influxdb, we can (and likely will not), have
an option to do something like count(time) and work from there.

So from this, we have two choices;

1. Either we need to select one field per measurement, or
2. We need to extract one representative field from each measurement

So really we have one choice. We need to reduce the set of fields into one.



Choice one is pretty easy for telegraf plugins - for example, 'uptime' may be a
good value for the `system` plugin.


But in my case - my `big_measurement` was mixed in with... 123 other measurements.


Crap.

---

Okay... well it's 2.8 MB of JSON....

I could pull it into python.


Step 1.

Grafana dashboard that gets list of measurements


Step 2. Get count per measurement

```
SELECT count(*) from /$measurements/ WHERE $timeFilter
```


Each measurment name, with it's largest column value that is not time

```
jq '[ .response.results[].series[] | {measurment: .name,  values_this_time_period: .values[0][2:] | max} ] ' op.file
```


```
jq '[ .response.results[].series[].values[0][2:] | max ] | add' op.file

```

---

[link][1] [Link2][2]

![thinking](https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/google/241/thinking-face_1f914.png)

![yeah!](https://media.giphy.com/media/RrVzUOXldFe8M/giphy.gif)

[1]: https://grafana.com/
[2]: https://grafana.com/grafana/plugins/pierosavi-imageit-panel
[3]: https://help.github.com/en/enterprise/2.13/user/articles/configuring-a-publishing-source-for-github-pages
