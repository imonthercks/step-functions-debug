#!/bin/bash
echo 'Starting Lambda Function Host...'
echo "Exposing $1 Function for debugging."

sam build

docker stop $(docker ps -a | awk '$2 ~ "amazon/aws-sam-cli-emulation" { print $1 }')
docker rm $(docker ps -a | awk '$2 ~ "amazon/aws-sam-cli-emulation" { print $1 }')

sam local start-lambda -d 5890 --warm-containers EAGER --debug-function $1Function