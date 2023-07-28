# Staking
A repo that links historical staking and up coming staking projects

## Dev

We recommend using vscode + remote docker. Open in VS code remote docker and execute the following:

```bash
# install dependencies
npm install

# define the variable in the .env file from .env.example
set -o allexport
source .env.dev
set +o allexport

# compile
yarn compile

# deploy, see package.json for the following pattern: deploy:<...>
npm run deploy:<...>
```

Some util commands:

```bash
npx hardhat run scripts/staking-deploy.ts --network ${NETWORK}
```
