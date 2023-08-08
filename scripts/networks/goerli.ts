import { Contract } from 'ethers';
import { TokenInfo, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    linkTokenAddress: string;
}

export async function makeConfig(): Promise<Config> {
    const systemConfig: SystemConfig = {
        // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
        aavePoolAddress: '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790', // Pool-Proxy-Aave
        aTokenAddress: '0x1a80eF9C6a2eAD07E8F42FB1CBb426587EEe0D7D', // AToken-Aave
        // https://docs.compound.finance/v2/#networks
        cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a', // cDAI
        // https://docs.uniswap.org/contracts/v3/reference/deployments
        uniswapRouterAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        earningTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',// DAI
    }

    return {
        systemConfig: systemConfig,
        
        ethTokenAddress: '0xCCB14936C2E000ED8393A571D15A2672537838Ad', // WETH
        linkTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',// DAI
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