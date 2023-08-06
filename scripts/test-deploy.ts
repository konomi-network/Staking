import { ethers } from 'hardhat';
import { deployContract } from './utils/deploy.util';

import {
    makeCombos,
    makeConfig
} from './dev.env'

import { Contract } from 'ethers';

const CONTRACT_NAME = 'Earning';

async function main() {
    try {
        const [deployer] = await ethers.getSigners();
        console.log(`Deploying contracts with account: ${await deployer.getAddress()}`);

        const config = await makeConfig();

        const PLATFORM_FEE = 1000; // 1%
        const MAX_PER_USER_DEPOSIT = 10000;
        const MIN_DEPOSIT_AMOUNT = 1000;

        const deployAaveEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            return await deployContract(deployer, 'AaveEarningPool', [
                config.aavePoolAddress, config.aTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT
            ]);
        }

        const deployCompoundEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            return await deployContract(deployer, 'CompoundEarningPool', [
                config.cTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT
            ]);
        }
        
        const ethEarningPoolContract = await deployAaveEarningPool(config.ethTokenAddress);
        const linkEarningPoolContract = await deployCompoundEarningPool(config.linkTokenAddress);

        const contract = await deployContract(deployer, CONTRACT_NAME, []);
        await contract.initialize(
            config.earningTokenAddress,
            PLATFORM_FEE,
            config.uniswapRouterAddress,
            MAX_PER_USER_DEPOSIT,
            MIN_DEPOSIT_AMOUNT,
            makeCombos(config, await ethEarningPoolContract.getAddress(), await linkEarningPoolContract.getAddress())
        );
        await ethEarningPoolContract.initialize(await contract.getAddress());
        await linkEarningPoolContract.initialize(await contract.getAddress());

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();