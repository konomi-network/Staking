import { Earning } from '../typechain-types/contracts/Earning';
import { expandTo18Decimals, loadCacheContract, loadSystemConfig, tryExecute } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        console.log(`Handling contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const systemConfig = await loadSystemConfig();

        const contractConfigs ={
            'Earning': {
                contractName: 'Earning',
                args: [
                    systemConfig.earningTokenAddress,
                    systemConfig.platformFee,
                    systemConfig.uniswapRouterAddress,
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
            }
        }

        const contractConfig = contractConfigs['daiAaveEarningPool'];
        const cacheContract = await loadCacheContract(deployer, contractConfig.contractName, contractConfig.args) as unknown as Earning;
        await cacheContract.setMaxPerUserDeposit(expandTo18Decimals(10000));
    });
}

main();