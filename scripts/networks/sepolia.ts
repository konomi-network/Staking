import { Contract } from 'ethers';
import { Combo, TokenInfo, makeCombo, makeEarningToken } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import { deployContract, expandTo18Decimals } from '../utils/deploy.util';
import { ethers } from 'hardhat';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    wethTokenAddress: string;
    linkTokenAddress: string;
    daiTokenAddress: string;
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
        // https://sepolia.etherscan.io/address/0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD
        uniswapRouterAddress: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
        uniswapPermit2Address: '0x000000000022d473030f116ddee9f6b43ac78ba3',
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        earningTokenAddress: await earningToken.getAddress(),

        platformFee: 1000, // 1%
        maxPerUserDeposit: expandTo18Decimals(10000),
        minDepositAmount: expandTo18Decimals(1000),
        maxInterestRate: 1000, // 10%
    }

    return {
        systemConfig: systemConfig,
        
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        wethTokenAddress: '0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92',
        linkTokenAddress: '0x8a0E31de20651fe58A369fD6f76c21A8FF7f8d42',
        daiTokenAddress: '0x68194a729c2450ad26072b3d33adacbcef39d574',
    }
}

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.wethTokenAddress),
        'LINK': await deployAaveEarningPool(config.linkTokenAddress),
        'DAI': await deployAaveEarningPool(config.daiTokenAddress),
        // 'LINK': await deployCompoundEarningPool(config.daiTokenAddress),
    }
}

export async function makeCombos(config: Config, earningPoolContracts: {[key: string]: Contract}): Promise<Combo[]> {
    const tokenWeth: TokenInfo = {
        name: 'WETH',
        token: config.wethTokenAddress,
        earningContract: await earningPoolContracts.WETH.getAddress(),
    };

    const tokenLink: TokenInfo = {
        name: 'LINK',
        token: config.linkTokenAddress,
        earningContract: await earningPoolContracts.LINK.getAddress(),
    };

    const tokenDai: TokenInfo = {
        name: 'DAI',
        token: config.daiTokenAddress,
        earningContract: await earningPoolContracts.DAI.getAddress(),
    };

    const combos = [
        {
            creditRating: 0,
            entries: [makeCombo(30, makeEarningToken(0, tokenWeth)), makeCombo(70, makeEarningToken(1, tokenLink))]
        },
        {
            creditRating: 1,
            entries: [makeCombo(40, makeEarningToken(2, tokenDai)), makeCombo(60, makeEarningToken(3, tokenLink))]
        }
    ];

    for (const combo of combos) {
        console.log(`{\ncreditRating: ${combo.creditRating},`);
        console.log('entries:', combo.entries);
        console.log('}')
    }
    return combos;
}