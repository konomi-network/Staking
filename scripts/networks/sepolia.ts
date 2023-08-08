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
        cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a', // cDAI
        // https://docs.uniswap.org/contracts/v3/reference/deployments
        uniswapRouterAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        earningTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',// DAI
    }

    return {
        systemConfig: systemConfig,
        
        ethTokenAddress: '0xCCB14936C2E000ED8393A571D15A2672537838Ad', // WETH
        daiTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',// DAI
    }
}

export async function deployEarningPoolContracts(config: Config, deployAaveEarningPool: Function, deployCompoundEarningPool: Function): Promise<{[key: string]: Contract}> {
    return {
        'WETH': await deployAaveEarningPool(config.ethTokenAddress),
        'DAI': await deployCompoundEarningPool(config.daiTokenAddress),
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
        name: 'DAI',
        token: config.daiTokenAddress,
        earningContract: await earningPoolContracts.DAI.getAddress(),
    });

    return [{
        creditRating: 0,
        entries: [tokenWeth, tokenLink]
    }]    
}