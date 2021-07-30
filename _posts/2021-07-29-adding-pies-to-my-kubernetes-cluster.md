---
layout:     post
title:      Pibernetes - via microk8s and via Rancher
date:       2021-07-27 23:00:00
summary:    This is more a reminder to myself than anything
categories: productivity
tags:
 - devops
 - pi
 - kubernetes
 - k8s
 - rancher
 - microk8s
 - rasbperrypi
---


## MicroK8s Flavour

#### on new pi
1. Image a microsdcard with ubuntu 64 bit pi image; boot & wait for cloud-init
2. `hostnamectl set-hostname 'pi-slice-n'``
3. `adduser {{user}}`
4. `usermod -aG sudo {{user}}`
5. `sudo snap install microk8s --classic`
6. `snap info microk8s`

#### on primary node`
1. `sudo microk8s.add-node`

#### on new node
1. `sudo microk8s.join {{ip}}:{{port}}/{{token}}`

#### Done


## Rancher Flavour
#### On Rancher Box
1. `sudo docker run --privileged -d --restart=unless-stopped -p 80:80 -p 443:443 rancher/rancher`
2. Once docker running, nav to 'add cluster - custom'
3. Once at 'Customize Node Run Command'; generate start commands:
- at least one of each of `etcd`, `control plane`, `worker`
- one node can be all three

#### EG:
1. One node as [`etcd`,`control plane`]
2. One node as [`worker`]


#### On Each pi node
1. `sudo snap install docker.io`
2. Copy 'registration command' from Rancher + run on each box

#### Back to Rancher Box
1. Observe nodes being added to cluster!
 


---
### Refs
1: [How to build a Raspberry Pi Kubernetes cluster using MicroK8s][1]
---

[1]: https://ubuntu.com/tutorials/how-to-kubernetes-cluster-on-raspberry-pi#4-installing-microk8s
