#!/bin/bash

source .env

now=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$now] Start upgrading contracts to network $NETWORK..." | tee -a upgrade.log
NETWORK=$NETWORK npm run upgrade | tee -a upgrade.log
