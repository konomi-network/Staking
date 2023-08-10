import { network } from 'hardhat';
import { Contract } from 'ethers';
import { tryExecute, deployContractWithProxy } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        const env = require(`./networks/${network.name}`)

        console.log(`Deploying contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const config = await env.makeConfig();
        const systemConfig = config.systemConfig;

        const PLATFORM_FEE = 1000; // 1%
        const MAX_PER_USER_DEPOSIT = 10000;
        const MIN_DEPOSIT_AMOUNT = 1000;
        const MAX_INTEREST_RATE = 1000; // 10%;

        const deployAaveEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            const args = [systemConfig.aavePoolAddress, systemConfig.aTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE];
            return await deployContractWithProxy(deployer, 'AaveEarningPool', args);
        }

        const deployCompoundEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            const args = [systemConfig.cTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE];
            return await deployContractWithProxy(deployer, 'CompoundEarningPool', args);
        }
        
        const earningPoolContracts = await env.deployEarningPoolContracts(config, deployAaveEarningPool, deployCompoundEarningPool);

        const combos = await env.makeCombos(config, earningPoolContracts);

        const contract = await deployContractWithProxy(deployer, 'Earning', [
            systemConfig.earningTokenAddress,
            PLATFORM_FEE,
            systemConfig.uniswapRouterAddress,
            MAX_PER_USER_DEPOSIT,
            MIN_DEPOSIT_AMOUNT,
            combos
        ]);

        for (const key of Object.keys(earningPoolContracts)) {
            await earningPoolContracts[key].setInvoker(await contract.getAddress());
        }
    });
}

main();