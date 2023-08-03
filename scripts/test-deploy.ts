import { ethers } from 'hardhat';
import {
    deployContract,
    deployContractWithProxy
} from './utils/deploy.util';

import {
    makeCombos,
    ethTokenAddress,
    linkTokenAddress
} from './dev.env'

const CONTRACT_NAME = 'Earning';

async function main() {
    try {
        const [deployer] = await ethers.getSigners();
        console.log(`Deploying contracts with account: ${await deployer.getAddress()}`);

        const PLATFORM_FEE = 1000; // 1%
        const MAX_PER_USER_DEPOSIT = 10000;
        const MIN_DEPOSIT_AMOUNT = 1000;

        const aavePoolContract = await deployContract(deployer, 'MockAavePool', []);
        const aavePoolAddress = await aavePoolContract.getAddress();

        const aToken = await deployContractWithProxy(deployer, 'MockAToken', ['AAVE ERC20', 'AAVE']);
        const aTokenAddress = await aToken.getAddress();

        const earningToken = await deployContract(deployer, 'MockERC20', ['USDA', 'USDA']);
        const earningTokenAddress = await earningToken.getAddress();

        const swapRouterContract = await deployContract(deployer, 'MockSwapRouter', []);
        const uniswapRouterAddress = await swapRouterContract.getAddress();

        const deployEarningPool = async(earningTokenAddress: string): Promise<string> => {
            const contract = await deployContract(deployer, 'AaveEarningPool', [
                aavePoolAddress, aTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT
            ]);
            return await contract.getAddress();
        }
        
        const ethEarningPoolContractAddress = await deployEarningPool(ethTokenAddress);
        const linkEarningPoolContractAddress = await deployEarningPool(linkTokenAddress);

        const contract = await deployContract(deployer, CONTRACT_NAME, []);
        await contract.initialize(
            earningTokenAddress,
            PLATFORM_FEE,
            uniswapRouterAddress,
            MAX_PER_USER_DEPOSIT,
            MIN_DEPOSIT_AMOUNT,
            makeCombos(ethEarningPoolContractAddress, linkEarningPoolContractAddress)
        );

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();