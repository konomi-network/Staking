import { UpgradeContract, loadCacheContractAddress, loadSystemConfig, tryExecute } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        console.log(`Upgrading contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const systemConfig = await loadSystemConfig();

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
            }
        }

        const contractConfig = contractConfigs['Earning'];
        const cacheContractAddress = loadCacheContractAddress(contractConfig.contractName, contractConfig.args)
        await UpgradeContract(deployer, contractConfig.contractName, cacheContractAddress);
    });
}

main();