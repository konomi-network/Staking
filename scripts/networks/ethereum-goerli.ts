import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import { decimalsOf, expandToNDecimals } from '../utils/deploy.util';
import IChain, { IConfig } from './IChain';

export interface Config extends IConfig {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    daiTokenAddress: string;
}

export default class Chain extends IChain {
    async makeConfig(): Promise<Config> {
        const [deployer] = await ethers.getSigners();

        const earningTokenAddress = '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC';
        const decimals = await decimalsOf(earningTokenAddress);

        const systemConfig: SystemConfig = {
            // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
            aavePoolAddress: '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790',
            aTokenAddress: '0x1a80eF9C6a2eAD07E8F42FB1CBb426587EEe0D7D',

            // https://docs.compound.finance/v2/#networks
            cTokenAddress: '0x0545a8eaF7ff6bB6F708CbB544EA55DBc2ad7b2a',
            cometAddress: 'NOT_SUPPORT',

            // https://docs.uniswap.org/contracts/v3/reference/deployments
            uniswapRouterAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
            uniswapPermit2Address: '0x000000000022d473030f116ddee9f6b43ac78ba3',

            earningTokenAddress: earningTokenAddress,

            platformFee: 1000,
            maxPerUserDeposit: String(expandToNDecimals(10000, decimals)),
            minDepositAmount: String(expandToNDecimals(1000, decimals)),
            maxInterestRate: 1000,
        }

        return {
            deployer,
            systemConfig,
            
            ethTokenAddress: '0xCCB14936C2E000ED8393A571D15A2672537838Ad', // WETH
            daiTokenAddress: '0x2899a03ffDab5C90BADc5920b4f53B0884EB13cC',// DAI
        }
    }

    async deployEarningPools(config: Config): Promise<{ [key: string]: Contract}> {
        return {
            'WETH': await this.deployAaveEarningPool(config, config.ethTokenAddress),
            'DAI': await this.deployCompoundV2EarningPool(config, config.daiTokenAddress),
        }
    }

    async makeCombos(config: Config, earningPoolContracts: { [key: string]: Contract; }): Promise<Combo[]> {
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
}