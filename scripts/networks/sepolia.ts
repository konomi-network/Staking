import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import { deployContract } from '../utils/deploy.util';
import { ethers } from 'hardhat';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    linkTokenAddress: string;
}

export async function makeConfig(): Promise<Config> {
    const [deployer] = await ethers.getSigners();
    
    const earningToken = await deployContract(deployer, 'MockERC20', ['kETH', 'kETH']);
    
    const systemConfig: SystemConfig = {
        // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
        aavePoolAddress: '0xE7EC1B0015eb2ADEedb1B7f9F1Ce82F9DAD6dF08', // Pool-Proxy-Aave
        aTokenAddress: '0x177F4611B27Cb66f5E6A51B4DD956f37A75F883B', // AToken-Aave
        // https://docs.compound.finance/v2/#networks
        cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a', // cDAI - not support this network
        // https://docs.uniswap.org/contracts/v3/reference/deployments
        // https://sepolia.etherscan.io/address/0x0227628f3F023bb0B980b67D528571c95c6DaC1c
        uniswapRouterAddress: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        earningTokenAddress: await earningToken.getAddress(),

        platformFee: 1000, // 1%
        maxPerUserDeposit: 10000,
        minDepositAmount: 1000,
        maxInterestRate: 1000, // 10%
    }

    return {
        systemConfig: systemConfig,
        
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        ethTokenAddress: '0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92', // WETH
        linkTokenAddress: '0x8a0E31de20651fe58A369fD6f76c21A8FF7f8d42',// LINK
    }
}

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.ethTokenAddress),
        'LINK': await deployAaveEarningPool(config.linkTokenAddress),
        // 'LINK': await deployCompoundEarningPool(config.daiTokenAddress),
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