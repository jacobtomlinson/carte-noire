---
layout:     post
title:      Embed image in grafana dashboard using github pages
date:       2020-06-18 23:35:25
summary:    Use Github Pages to host images to embed in Grafana
categories: grafana
thumbnail: ImageIt
tags:
 - grafana
 - devops
 - github
 - ImageIt
---


After having the plugin installed for a couple of years, I finally used
[Grafana][1]'s [ImageIt][2] plugin on a dashboard request.

ImageIt enables you to overlay information on top of an image map. It's a little
bit tedious use at the moment, missing a needs a 'duplicate' button in the metric
mappings.

---

The point here though - was that I wanted to avoid standing up a web server just
to embed the image - as [Grafana dashboards are json][3], well behaving panels
seem to avoid trying to do things like embed an image by converting to base64 or
some such.

We do have a github enterprise server at the ( remote ) shop though.

Low and behold, I was able to [activate github pages](https://help.github.com/en/enterprise/2.13/user/articles/configuring-a-publishing-source-for-github-pages) on a public repo, and host
the image pain free in minutes.

I'll be using this one quite a bit I think. The one caveat is that the images
are public - so sensitive information needs another solution.

[1]: https://grafana.com/
[2]: https://grafana.com/grafana/plugins/pierosavi-imageit-panel
[3]: https://grafana.com/docs/grafana/latest/reference/dashboard/#:~:text=A%20dashboard%20in%20Grafana%20is,variables%2C%20panel%20queries%2C%20etc.
