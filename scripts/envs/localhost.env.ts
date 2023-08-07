import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { TokenInfo, makeCombo } from '../utils/combo.util';
import {
    deployContract,
    deployContractWithProxy
} from '../utils/deploy.util';

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

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.ethTokenAddress),
        'LINK': await deployCompoundEarningPool(config.linkTokenAddress),
    }
}

export async function makeCombos(config: Config, earningPoolContracts: {[key: string]: Contract}) {
    const tokenWeth: TokenInfo = {
        id: 0,
        tokenName: 'WETH',
        tokenAddress: config.ethTokenAddress,
        earningPoolContractAddress: await earningPoolContracts.WETH.getAddress(),
    }

    const tokenLink: TokenInfo = {
        id: 1,
        tokenName: 'LINK',
        tokenAddress: config.linkTokenAddress,
        earningPoolContractAddress: await earningPoolContracts.LINK.getAddress(),
    }

    return [{
        creditRating: 0,
        entries: [
            makeCombo(30, tokenWeth),
            makeCombo(70, tokenLink),
        ]
    }]    
}