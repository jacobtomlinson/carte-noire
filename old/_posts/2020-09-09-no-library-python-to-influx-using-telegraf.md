---
layout:     post
title:      Python 2 Influx via Telegraf
date:       2020-09-09 21:00:25
summary:    Getting from your simple Python code into Influx with no library using telegraf
categories: Influx
thumbnail: imageit
tags:
 - influxdb
 - influx
 - devops
 - telegraf
---

# So you've got some simple data, and you need it to send it towards influxdb
Really, there are libraries for this.
-   libraries don't work if you have no internet
-   Or maybe you want portability

Using telegraf, we can parse many simple [input formats][1], including:

-   Value
>  a single value
-   CSV
>  a line of delimited values
-   Influx Line Protocol
>  a line of metrics, separated into tags and fields and ready for storage
-   JSON
>  a mixed bag - could be separated, could be just random. The biggest and slowest of the four.

Each with their own advantages and disadvantages.

Influx Line protocol is my preferred - easy to read on a screen or from a file, and easy to grep through.

Some pain in escaping characters if building it yourself.






[1]: https://docs.influxdata.com/telegraf/v1.15/data_formats/input/


[2]: https://grafana.com/grafana/plugins/pierosavi-imageit-panel
[3]: https://help.github.com/en/enterprise/2.13/user/articles/configuring-a-publishing-source-for-github-pages
