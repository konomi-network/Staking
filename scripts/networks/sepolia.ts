import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    daiTokenAddress: string;
}

export async function makeConfig(): Promise<Config> {
    const systemConfig: SystemConfig = {
        // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
        aavePoolAddress: '0xE7EC1B0015eb2ADEedb1B7f9F1Ce82F9DAD6dF08', // Pool-Proxy-Aave
        aTokenAddress: '0x177F4611B27Cb66f5E6A51B4DD956f37A75F883B', // AToken-Aave
        // https://docs.compound.finance/v2/#networks
        cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a', // cDAI - not support this network
        // https://docs.uniswap.org/contracts/v3/reference/deployments
        // https://sepolia.etherscan.io/address/0x0227628f3F023bb0B980b67D528571c95c6DaC1c
        uniswapRouterAddress: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        earningTokenAddress: '0x68194a729C2450ad26072b3D33ADaCbcef39D574',// DAI
    }

    return {
        systemConfig: systemConfig,
        
        // https://sepolia.etherscan.io/address/0xe7ec1b0015eb2adeedb1b7f9f1ce82f9dad6df08#readProxyContract
        ethTokenAddress: '0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92', // WETH
        daiTokenAddress: '0x8a0E31de20651fe58A369fD6f76c21A8FF7f8d42',// LINK
    }
}

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.ethTokenAddress),
        'LINK': await deployCompoundEarningPool(config.daiTokenAddress),
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
        token: config.daiTokenAddress,
        earningContract: await earningPoolContracts.LINK.getAddress(),
    });

    return [{
        creditRating: 0,
        entries: [tokenWeth, tokenLink]
    }]    
}