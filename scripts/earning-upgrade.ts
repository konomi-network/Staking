import { network } from 'hardhat';
import IChain from './networks/IChain';
import { UpgradeContract, loadCacheContract, loadCacheContractAddress, tryExecute } from './utils/deploy.util';
import { EarningSwapRouter } from '../typechain-types/contracts/EarningSwapRouter';
import { Earning } from '../typechain-types/contracts/Earning';

async function main() {
    await tryExecute(async (deployer) => {
        const Chain = require(`./networks/${network.name}`).default;
        const chain: IChain = new Chain();
        
        console.log(`Upgrading contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const config = await chain.makeConfig();
        const systemConfig = config.systemConfig;

        const earningSwapRouter = await loadCacheContract(deployer, 'EarningSwapRouter', [
            systemConfig.uniswapRouterAddress,
            systemConfig.uniswapPermit2Address,
        ]) as unknown as EarningSwapRouter;

        const earning = await loadCacheContract(deployer, 'Earning', [
            systemConfig.earningTokenAddress,
            systemConfig.platformFee,
            await earningSwapRouter.getAddress(),
            systemConfig.maxPerUserDeposit,
            systemConfig.minDepositAmount,
            '[object Object],[object Object]'
        ]) as unknown as Earning;

        await UpgradeContract(deployer, 'Earning', await earning.getAddress());
    });
}

main();