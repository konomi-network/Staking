import { Earning } from '../typechain-types/contracts/Earning';
import { network } from 'hardhat';
import IChain from './networks/IChain';
import { expandTo6Decimals, loadCacheContract, tryExecute } from './utils/deploy.util';
import { EarningSwapRouter } from '../typechain-types/contracts/EarningSwapRouter';

async function main() {
    await tryExecute(async (deployer) => {
        const Chain = require(`./networks/${network.name}`).default;
        const chain: IChain = new Chain();
        
        console.log(`Testing contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

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
        
        const combos = await earning.listAllCombos();
        console.log(`\n>>> Earning ${combos.length} combos`);
        let i = 0;
        for (const combo of combos) {
            console.log(`comboId: ${i} creditRating:${combo.creditRating} APY: ${await earning.averageAPY(i)}`);
            console.log(`\tentries: ${combo}`);
            i++;
        }

        let userDetail = await earning.listUserEarnDetail();
        console.log(`\n>>> Earning ${userDetail.length} userEarnDetail`);

        // await earning.setMinDepositAmount(1000);

        console.log(`\n>>> Earning deposit: ${await earning.deposit(1, expandTo6Decimals(2000))}`);

        userDetail = await earning.listUserEarnDetail();
        console.log(`\n>>> Earning ${userDetail.length} userEarnDetail after deposit`);
    });
}

main();