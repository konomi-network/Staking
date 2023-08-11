import { UpgradeContract, loadCacheContractAddress, loadSystemConfig, tryExecute } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        console.log(`Upgrading contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const systemConfig = await loadSystemConfig();

        const args = [
            systemConfig.earningTokenAddress,
            systemConfig.platformFee,
            systemConfig.uniswapRouterAddress,
            systemConfig.maxPerUserDeposit,
            systemConfig.minDepositAmount,
            '[object Object]'
        ]

        const contractName = 'Earning';
        const cacheContractAddress = loadCacheContractAddress(contractName, args)
        await UpgradeContract(deployer, contractName, cacheContractAddress);
    });
}

main();