OSX needs to use aufs

```
Storage Driver: aufs
 Root Dir: /var/lib/docker/aufs
 Backing Filesystem: extfs
 Dirs: 88
 Dirperm1 Supported: true
```

https://stackoverflow.com/questions/39455764/change-storage-driver-for-docker-on-os-x

### Squashing image for pushing
pip3 install docker-squash
git pull quay.io/pires/docker-elasticsearch-kubernetes:5.3.2
docker-squash -f 29 -t gcr.io/proudcity-1184/docker-elasticsearch-kubernetes:5.3.2 quay.io/pires/docker-elasticsearch-kubernetes:5.3.2
gcloud docker -- push gcr.io/proudcity-1184/docker-elasticsearch-kubernetes:5.3.2