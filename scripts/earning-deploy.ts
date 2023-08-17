import { network } from 'hardhat';
import { tryExecute } from './utils/deploy.util';
import IChain from './networks/IChain';

async function main() {
    await tryExecute(async (deployer) => {
        const Chain = require(`./networks/${network.name}`).default;
        const chain: IChain = new Chain();
        
        console.log(`Deploying contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const config = await chain.makeConfig();
        
        const earningPools = await chain.deployEarningPools(config);

        const combos = await chain.makeCombos(config, earningPools);

        const earningSwapRouter = await chain.deployEarningSwapRouter(config);
        const earningSwapRouterAddr = await earningSwapRouter.getAddress();

        const contract = await chain.deployEarning(config, earningSwapRouterAddr, combos);

        for (const key of Object.keys(earningPools)) {
            try {
                await earningPools[key].setInvoker(await contract.getAddress());
            } catch (error) {
                console.error(`${key} setInvoker failed by ${error}`)
            }
        }

        try {
            await earningSwapRouter.setInvoker(await contract.getAddress());
        } catch (error) {
            console.error(`earningSwapRouter setInvoker failed by ${error}`)
        }
    });
}

main();