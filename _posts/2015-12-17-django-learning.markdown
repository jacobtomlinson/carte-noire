---
title:  "Nobody else was around."
subtitle: "django learning"
author: "Shadow"
avatar: "image/IMG_2916.jpg"

date:   2015-04-21 12:12:12
---

#0x00：开始接触
在刚开学python时遇到有很多特别火的开源工程，其中有个名字特别古怪，很吸引我的注意，django 想不通为什么叫这么一个名字，就在网上查了一下，发现是个挺火的项目呢。哦 做网站的，嗯 刚好这两天学了HTML，也想把学的发布到网上。说着就玩起来了，不得不说，配环境是我最烦的了，前前后后总共花了我7天才把环境配好。然后看着网上的简单教程敲了一下，然后./manag.py runserver 0.0.0.0:8080 。done！ 这样我就可以在手机，各个地方查看我自己的网页了。嗯有的玩，快考试了有时间再看吧。
#0x01： 进一步学习
here we come the point that really matter. 
这两天没事就仔细看了一下django book https://django-book.readthedocs.org/en/latest/index.html 
第一次写博客，没有什么特别的思路，就把自己对于models的功能的理解写一下。
根据django的mvc设计模式，models 适用于进行数据的控制的。通过models我们可以简单快速的进行数据库的操作，django book的作者对于这个设计提了很多优点，其中有一个我很赞同
"Writing Python is fun, and keeping everything in Python limits the number of times your brain has to do a “context switch.” It helps productivity if you keep yourself in a single programming environment/mentality for as long as possible. Having to write SQL, then Python, and then SQL again is disruptive."
经常的进行上下文切换是我一直以来相信也是很多人的苦痛，总是在做完sql然后又忘记python应该怎么写了。通过这个封装使得我没不用去思考sql该怎么写，只要知道要怎么去处理这些数据就可以了。
使用models，我们需要先进行install_app 就像是注册一样，类似于Android的permission 声明一样，证明这个app有models等的使用权限。然后再app目录下的models.py 下对声明各个model 然后执行migrate ？？ 将model设置应用到数据库中去。
先写到这里，又饿又困，night
