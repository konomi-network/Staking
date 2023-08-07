import { ethers, network } from 'hardhat';
import { Contract } from 'ethers';
import { deployContract } from './utils/deploy.util';

const CONTRACT_NAME = 'Earning';

async function main() {
    try {
        const startTime = `>>> Deploy contract to \x1b[33m${network.name}\x1b[0m network`;
        console.time(startTime);

        const env = require(`./envs/${network.name}.env`)
        const [deployer] = await ethers.getSigners();
        console.log(`>>> Deploying contracts with account: ${await deployer.getAddress()}`);

        const config = await env.makeConfig();
        const systemConfig = config.systemConfig;

        const PLATFORM_FEE = 1000; // 1%
        const MAX_PER_USER_DEPOSIT = 10000;
        const MIN_DEPOSIT_AMOUNT = 1000;
        const MAX_INTEREST_RATE = 1000; // 10%;

        const deployAaveEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            return await deployContract(deployer, 'AaveEarningPool', [
                systemConfig.aavePoolAddress, systemConfig.aTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE
            ]);
        }

        const deployCompoundEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            return await deployContract(deployer, 'CompoundEarningPool', [
                systemConfig.cTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE
            ]);
        }
        
        const earningPoolContracts = await env.deployEarningPoolContracts(config, deployAaveEarningPool, deployCompoundEarningPool);

        const combos = await env.makeCombos(config, earningPoolContracts);

        const contract = await deployContract(deployer, CONTRACT_NAME, []);
        await contract.initialize(
            systemConfig.earningTokenAddress,
            PLATFORM_FEE,
            systemConfig.uniswapRouterAddress,
            MAX_PER_USER_DEPOSIT,
            MIN_DEPOSIT_AMOUNT,
            combos
        );

        for (const key of Object.keys(earningPoolContracts)) {
            await earningPoolContracts[key].initialize(await contract.getAddress());
        }

        console.timeEnd(startTime);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();