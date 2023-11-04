---
layout:     post
title:      Embed image in grafana dashboard using github pages
date:       2020-06-18 23:35:25
summary:    Use Github Pages to host images to embed in Grafana
categories: grafana
thumbnail: imageit
tags:
 - grafana
 - devops
 - github
 - ImageIt
---


After having the plugin installed for a couple of years, I finally used
[Grafana][1]'s [ImageIt][2] plugin on a dashboard request.

ImageIt enables you to overlay information on top of an image map. It's a little
bit tedious use at the moment, notably missing  'duplicate' button in the metric
mappings.

---

My dilemma though - was that the imageit plugin requires you give a url where the
image you want to embed will be hosted.

I wanted to avoid standing up a web server just to host this image.

![thinking](https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/google/241/thinking-face_1f914.png)

We do have a github enterprise server at the ( remote ) shop.

![yeah!](https://media.giphy.com/media/RrVzUOXldFe8M/giphy.gif)

Less than five minutes later, I was able to create a public repo, [activate github pages](3), and host
the image with no pain at all..

I'll be using this one quite a bit I think. Be careful though, the images
are public - so sensitive information needs another solution.

[1]: https://grafana.com/
[2]: https://grafana.com/grafana/plugins/pierosavi-imageit-panel
[3]: https://help.github.com/en/enterprise/2.13/user/articles/configuring-a-publishing-source-for-github-pages
