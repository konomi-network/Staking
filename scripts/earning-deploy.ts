import { network } from 'hardhat';
import { tryExecute } from './utils/deploy.util';
import IChain from './networks/IChain';

async function main() {
    await tryExecute(async (deployer) => {
        console.log(`Deploying contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const Chain = require(`./networks/${network.name}`).default;
        const chain: IChain = new Chain();
        
        await chain.deploy();
    });
}

main();