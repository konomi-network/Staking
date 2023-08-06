import { TokenInfo, makeCombo} from './utils/combo.util';
import { ethers } from 'hardhat';
import {
    deployContract,
    deployContractWithProxy
} from './utils/deploy.util';

export interface Config {
    aavePoolAddress: string;
    aTokenAddress: string;
    cTokenAddress: string;
    ethTokenAddress: string;
    linkTokenAddress: string;
    earningTokenAddress: string;
    uniswapRouterAddress: string;
}

export async function makeConfig(): Promise<Config> {
    const [deployer] = await ethers.getSigners();

    const aavePoolContract = await deployContract(deployer, 'MockAavePool', []);
 
    const aToken = await deployContractWithProxy(deployer, 'MockAToken', ['AAVE ERC20', 'AAVE']);

    const cToken = await deployContract(deployer, 'MockCToken', []);

    const ethToken = await deployContract(deployer, 'MockERC20', ['ETH', 'ETH']);
    const linkToken = await deployContract(deployer, 'MockERC20', ['LINK', 'LINK']);
    
    const earningToken = await deployContract(deployer, 'MockERC20', ['USDA', 'USDA']);
    
    const swapRouterContract = await deployContract(deployer, 'MockSwapRouter', []);

    return {
        aavePoolAddress: await aavePoolContract.getAddress(),
        aTokenAddress: await aToken.getAddress(),
        cTokenAddress: await cToken.getAddress(),
        ethTokenAddress: await ethToken.getAddress(),
        linkTokenAddress: await linkToken.getAddress(),
        earningTokenAddress: await earningToken.getAddress(),
        uniswapRouterAddress: await swapRouterContract.getAddress()
    }
}

export function makeCombos(config: Config, ethEarningPoolAddress: string, linkEarningAddress: string) {
    const tokenWeth: TokenInfo = {
        id: 0,
        tokenName: 'WETH',
        tokenAddress: config.ethTokenAddress,
        earningPoolContractAddress: ethEarningPoolAddress,
    }

    const tokenLink: TokenInfo = {
        id: 1,
        tokenName: 'LINK',
        tokenAddress: config.linkTokenAddress,
        earningPoolContractAddress: linkEarningAddress,
    }

    return [{
        creditRating: 0,
        entries: [
            makeCombo(30, tokenWeth),
            makeCombo(70, tokenLink),
        ]
    }]    
}