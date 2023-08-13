import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import { expandTo18Decimals } from '../utils/deploy.util';

export interface Config {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    daiTokenAddress: string;
}

export async function makeConfig(): Promise<Config> {
    const systemConfig: SystemConfig = {
        // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
        aavePoolAddress: '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790',
        aTokenAddress: '0x1a80eF9C6a2eAD07E8F42FB1CBb426587EEe0D7D',

        // https://docs.compound.finance/v2/#networks
        cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a',

        // https://docs.uniswap.org/contracts/v3/reference/deployments
        uniswapRouterAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        uniswapPermit2Address: '0x000000000022d473030f116ddee9f6b43ac78ba3',

        earningTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',

        platformFee: 1000,
        maxPerUserDeposit: expandTo18Decimals(10000),
        minDepositAmount: expandTo18Decimals(1000),
        maxInterestRate: 1000,
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
        earningContract: await earningPoolContracts.WETH.getAddress(), // 0xaD3B60878BAEa5f1eF6C294AB55cdc99778aCa4D
    });

    const tokenLink: ComboEntry = makeCombo(70, {
        id: 1,
        name: 'DAI',
        token: config.daiTokenAddress,
        earningContract: await earningPoolContracts.DAI.getAddress(), // 0x053BfB8780349D2DD9CaE289146738B160d20615
    });

    return [{
        creditRating: 0,
        entries: [tokenWeth, tokenLink]
    }]    
}