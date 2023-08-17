import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { Combo, ComboEntry, makeCombo } from '../utils/combo.util';
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
        }
    }

    async makeCombos(config: Config, earningPoolContracts: { [key: string]: Contract; }): Promise<Combo[]> {
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

    async deployEarningPools(config: Config): Promise<{ [key: string]: Contract}> {
        return {
            'WETH': await this.deployAaveEarningPool(config, config.ethTokenAddress),
            'LINK': await this.deployCompoundV2EarningPool(config, config.linkTokenAddress),
        }
    }
}