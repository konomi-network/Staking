#!/bin/bash

source .env

now=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$now] Start testing contracts to network $NETWORK..." | tee -a test.log
npx hardhat run scripts/earning-test.ts --network $NETWORK | tee -a test.log
