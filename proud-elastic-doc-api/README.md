
## Deploy

docker build -t proudwpsite_elasticdocapi .
docker tag proudwpsite_elasticdocapi gcr.io/proudcity-1184/proud-elastic-doc-api:kubernetes.4
gcloud docker -- push gcr.io/proudcity-1184/proud-elastic-doc-api:kubernetes.4