#!/bin/bash

source .env

now=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$now] Start deploying contracts to network $NETWORK..." | tee -a deploy.log
NETWORK=$NETWORK npm run deploy | tee -a deploy.log
