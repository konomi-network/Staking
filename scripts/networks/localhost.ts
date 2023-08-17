import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { Combo, ComboEntry, TokenInfo, makeCombo, makeEarningToken } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import {
    deployContract,
    deployContractWithProxy,
    expandTo18Decimals
} from '../utils/deploy.util';
import IChain, { IConfig } from './IChain';

export interface Config extends IConfig {
    systemConfig: SystemConfig;

    // custom config
    ethTokenAddress: string;
    linkTokenAddress: string;
    usdcTokenAddress: string;
}

export default class Chain extends IChain {
    async makeConfig(): Promise<Config> {
        const [deployer] = await ethers.getSigners();

        const aavePoolContract = await deployContract(deployer, 'MockAavePool', []);
    
        const aToken = await deployContractWithProxy(deployer, 'MockAToken', ['AAVE ERC20', 'AAVE']);

        const cToken = await deployContract(deployer, 'MockCToken', []);
        const comet = await deployContract(deployer, 'MockComet', []);

        const ethToken = await deployContract(deployer, 'MockERC20', ['ETH', 'ETH']);
        const linkToken = await deployContract(deployer, 'MockERC20', ['LINK', 'LINK']);
        const usdcToken = await deployContract(deployer, 'MockERC20', ['USDC', 'USDC']);
        
        const earningToken = await deployContract(deployer, 'MockERC20', ['USDA', 'USDA']);
        
        const swapRouterContract = await deployContract(deployer, 'MockSwapRouter', []);
        const permit2Contract = await deployContract(deployer, 'MockPermit2', []);

        const systemConfig: SystemConfig = {
            aavePoolAddress: await aavePoolContract.getAddress(),
            aTokenAddress: await aToken.getAddress(),
            cTokenAddress: await cToken.getAddress(),
            cometAddress: await comet.getAddress(),
            uniswapRouterAddress: await swapRouterContract.getAddress(),
            uniswapPermit2Address: await permit2Contract.getAddress(),
            earningTokenAddress: await earningToken.getAddress(),
            platformFee: 1000, // 1%
            maxPerUserDeposit: String(expandTo18Decimals(10000)),
            minDepositAmount: String(expandTo18Decimals(1000)),
            maxInterestRate: 1000, // 10%
        }

        return {
            deployer,
            systemConfig,
            
            ethTokenAddress: await ethToken.getAddress(),
            linkTokenAddress: await linkToken.getAddress(),
            usdcTokenAddress: await usdcToken.getAddress(),
        }
    }

    async deployEarningPools(config: Config): Promise<{ [key: string]: Contract}> {
        return {
            'WETH': await this.deployAaveEarningPool(config, config.ethTokenAddress),
            'LINK': await this.deployCompoundV2EarningPool(config, config.linkTokenAddress),
            'USDC': await this.deployCompoundV3EarningPool(config, config.usdcTokenAddress),
        }
    }

    async makeCombos(config: Config, earningPoolContracts: { [key: string]: Contract; }): Promise<Combo[]> {
        const tokenWeth: TokenInfo = {
            name: 'WETH',
            token: config.ethTokenAddress,
            earningContract: await earningPoolContracts.WETH.getAddress(),
        };
    
        const tokenLink: TokenInfo = {
            name: 'LINK',
            token: config.linkTokenAddress,
            earningContract: await earningPoolContracts.LINK.getAddress(),
        };

        const tokenUsdc: TokenInfo = {
            name: 'USDC',
            token: config.usdcTokenAddress,
            earningContract: await earningPoolContracts.USDC.getAddress(),
        };
    
        const combos = [
            {
                creditRating: 0,
                entries: [makeCombo(30, makeEarningToken(0, tokenWeth)), makeCombo(70, makeEarningToken(1, tokenLink))]
            },
            {
                creditRating: 1,
                entries: [makeCombo(40, makeEarningToken(2, tokenUsdc)), makeCombo(60, makeEarningToken(3, tokenLink))]
            }
        ];

        for (const combo of combos) {
            console.log(`{\ncreditRating: ${combo.creditRating},`);
            console.log('entries:', combo.entries);
            console.log('}')
        }
        return combos;
    }
}