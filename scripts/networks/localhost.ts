import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import {
    deployContract,
    deployContractWithProxy
} from '../utils/deploy.util';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    linkTokenAddress: string;
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

    const systemConfig: SystemConfig = {
        aavePoolAddress: await aavePoolContract.getAddress(),
        aTokenAddress: await aToken.getAddress(),
        cTokenAddress: await cToken.getAddress(),
        uniswapRouterAddress: await swapRouterContract.getAddress(),
        earningTokenAddress: await earningToken.getAddress(),
    }

    return {
        systemConfig: systemConfig,
        
        ethTokenAddress: await ethToken.getAddress(),
        linkTokenAddress: await linkToken.getAddress(),
    }
}

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.ethTokenAddress),
        'LINK': await deployCompoundEarningPool(config.linkTokenAddress),
    }
}

export async function makeCombos(config: Config, earningPoolContracts: {[key: string]: Contract}): Promise<Combo[]> {
    const tokenWeth: ComboEntry = makeCombo(30, {
        id: 0,
        name: 'WETH',
        token: config.ethTokenAddress,
        earningContract: await earningPoolContracts.WETH.getAddress(),
    });

    const tokenLink: ComboEntry = makeCombo(70, {
        id: 1,
        name: 'LINK',
        token: config.linkTokenAddress,
        earningContract: await earningPoolContracts.LINK.getAddress(),
    });

    return [{
        creditRating: 0,
        entries: [tokenWeth, tokenLink]
    }]    
}