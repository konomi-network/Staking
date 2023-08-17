import { Earning } from '../typechain-types/contracts/Earning';
import { EarningSwapRouter } from '../typechain-types/contracts/EarningSwapRouter';
import { network } from 'hardhat';
import IChain from './networks/IChain';
import { loadCacheContract, tryExecute } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        const Chain = require(`./networks/${network.name}`).default;
        const chain: IChain = new Chain();
        
        console.log(`Handling contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const config = await chain.makeConfig();
        const systemConfig = config.systemConfig;
        
        const contractConfigs ={
            'Earning': {
                contractName: 'Earning',
                args: [
                    systemConfig.earningTokenAddress,
                    systemConfig.platformFee,
                    '0x41F0460047DF21c305A43D784c636Ac502Bf5e9B',
                    systemConfig.maxPerUserDeposit,
                    systemConfig.minDepositAmount,
                    '[object Object],[object Object]'
                ]
            },
            'daiAaveEarningPool': {
                contractName: 'AaveEarningPool',
                args: [
                    systemConfig.aavePoolAddress,
                    systemConfig.aTokenAddress,
                    '0x68194a729c2450ad26072b3d33adacbcef39d574',
                    systemConfig.maxPerUserDeposit,
                    systemConfig.maxInterestRate
                ]
            },
            'linkAaveEarningPool': {
                contractName: 'AaveEarningPool',
                args: [
                    systemConfig.aavePoolAddress,
                    systemConfig.aTokenAddress,
                    '0x8a0E31de20651fe58A369fD6f76c21A8FF7f8d42',
                    systemConfig.maxPerUserDeposit,
                    systemConfig.maxInterestRate
                ]
            },
            'EarningSwapRouter': {
                contractName: 'EarningSwapRouter',
                args: [
                    systemConfig.uniswapRouterAddress,
                    systemConfig.uniswapPermit2Address,
                ]
            }
        }

        const contractConfig = contractConfigs['EarningSwapRouter'];
        const cacheContract = await loadCacheContract(deployer, contractConfig.contractName, contractConfig.args) as unknown as EarningSwapRouter;
        // await cacheContract.setMaxPerUserDeposit(expandTo18Decimals(10000));
        // await cacheContract.setSwapRouter('0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD');
        await cacheContract.setPermit2('0x000000000022D473030F116dDEE9F6B43aC78BA3');
    });
}

main();