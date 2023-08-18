import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { Combo, TokenInfo, makeCombo, makeEarningToken } from '../utils/combo.util';
import { SystemConfig } from '../utils/config.util';
import { decimalsOf, expandToNDecimals } from '../utils/deploy.util';
import IChain, { IConfig } from './IChain';

export interface Config extends IConfig {
    systemConfig: SystemConfig;

    // custom config
    eursTokenAddress: string;
    linkTokenAddress: string;
    usdcTokenAddress: string;
}

export default class Chain extends IChain {
    async makeConfig(): Promise<Config> {
        const [deployer] = await ethers.getSigners();

        const earningTokenAddress = '0x8F30ec9Fb348513494cCC1710528E744Efa71003'; // USDT of compound
        const decimals = await decimalsOf(earningTokenAddress);
        
        const systemConfig: SystemConfig = {
            // https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses
            aavePoolAddress: '0xeAA2F46aeFd7BDe8fB91Df1B277193079b727655', // Pool-Proxy-Arbitrum
            aTokenAddress: '0x0aAFea73B7099a3C612dEDAACeB861FAE15fd207', // AToken-Arbitrum
            // https://docs.compound.finance/#networks
            cTokenAddress: 'NOT_SUPPORT',
            cometAddress: '0x1d573274E19174260c5aCE3f2251598959d24456',
            // https://docs.uniswap.org/contracts/v3/reference/deployments
            // https://goerli.arbiscan.io/address/0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD
            uniswapRouterAddress: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
            uniswapPermit2Address: '0x000000000022d473030f116ddee9f6b43ac78ba3',
            // https://goerli.arbiscan.io/address/0x8f30ec9fb348513494ccc1710528e744efa71003
            earningTokenAddress: earningTokenAddress, 

            platformFee: 1000, // 1%
            maxPerUserDeposit: String(expandToNDecimals(10000, decimals)),
            minDepositAmount: String(expandToNDecimals(100, decimals)),
            maxInterestRate: 1000, // 10%
        }

        return {
            deployer,
            systemConfig,
            
            // https://goerli.arbiscan.io/address/0xeAA2F46aeFd7BDe8fB91Df1B277193079b727655#readProxyContract
            eursTokenAddress: '0xe898C3C5185C35c00b5eaBea4713E2dBadD82879',
            linkTokenAddress: '0x56033E114c61183590d39BA847400F02022Ebe47',
            // https://docs.compound.finance/#networks
            usdcTokenAddress: '0x8FB1E3fC51F3b789dED7557E680551d93Ea9d892',
        }
    }

    async deployEarningPools(config: Config): Promise<{ [key: string]: Contract}> {
        return {
            'EURS': await this.deployAaveEarningPool(config, config.eursTokenAddress),
            'LINK': await this.deployAaveEarningPool(config, config.linkTokenAddress),
            'USDC': await this.deployCompoundV3EarningPool(config, config.usdcTokenAddress),
        }
    }

    async makeCombos(config: Config, earningPoolContracts: {[key: string]: Contract}): Promise<Combo[]> {
        const tokenEurs: TokenInfo = {
            name: 'EURS',
            token: config.eursTokenAddress,
            earningContract: await earningPoolContracts.EURS.getAddress(),
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
                entries: [makeCombo(30, makeEarningToken(0, tokenEurs)), makeCombo(70, makeEarningToken(1, tokenLink))]
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