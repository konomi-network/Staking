import { Contract, Signer } from 'ethers';
import { SystemConfig } from "../utils/config.util";
import { Combo } from '../utils/combo.util';
import { deployContractWithProxy } from '../utils/deploy.util';

export interface IConfig {
    deployer: Signer;
    systemConfig: SystemConfig;
}

export default abstract class IChain {
    abstract makeConfig(): Promise<IConfig>;

    abstract makeCombos(config: IConfig, earningPoolContracts: {[key: string]: Contract}): Promise<Combo[]>;

    abstract deployEarningPools(config: IConfig): Promise<{[key: string]: Contract}>;

    async deploy() {
        const config = await this.makeConfig();
        
        const earningPools = await this.deployEarningPools(config);

        const combos = await this.makeCombos(config, earningPools);

        const earningSwapRouter = await this.deployEarningSwapRouter(config);
        const earningSwapRouterAddr = await earningSwapRouter.getAddress();

        const contract = await this.deployEarning(config, earningSwapRouterAddr, combos);

        earningPools['earningSwapRouter'] = earningSwapRouter;
        await this.setInvokers(earningPools, await contract.getAddress());
        
        return contract;
    }

    async setInvokers(earningPools: {[key: string]: Contract}, contractAddr: string) {
        for (const key of Object.keys(earningPools)) {
            try {
                await earningPools[key].setInvoker(contractAddr);
            } catch (error) {
                console.error(`${key} setInvoker failed by ${error}`)
            }
        }
    }

    async deployEarning(config: IConfig, earningSwapRouterAddr: string, combos: Combo[]): Promise<Contract> {
        const systemConfig = config.systemConfig;
        const args = [
            systemConfig.earningTokenAddress,
            systemConfig.platformFee,
            earningSwapRouterAddr,
            systemConfig.maxPerUserDeposit,
            systemConfig.minDepositAmount,
            combos
        ];
        return await deployContractWithProxy(config.deployer, 'Earning', args);
    };

    async deployEarningSwapRouter(config: IConfig): Promise<Contract> {
        const systemConfig = config.systemConfig;
        const args = [
            systemConfig.uniswapRouterAddress,
            systemConfig.uniswapPermit2Address,
        ];
        return await deployContractWithProxy(config.deployer, 'EarningSwapRouter', args);
    }

    async deployAaveEarningPool(config: IConfig, earningTokenAddress: string): Promise<Contract> {
        const systemConfig = config.systemConfig;
        const args = [
            systemConfig.aavePoolAddress,
            systemConfig.aTokenAddress,
            earningTokenAddress,
            systemConfig.maxPerUserDeposit,
            systemConfig.maxInterestRate
        ];
        return await deployContractWithProxy(config.deployer, 'AaveEarningPool', args);
    }

    async deployCompoundV2EarningPool(config: IConfig, earningTokenAddress: string): Promise<Contract> {
        const systemConfig = config.systemConfig;
        const args = [
            systemConfig.cTokenAddress,
            earningTokenAddress,
            systemConfig.maxPerUserDeposit,
            systemConfig.maxInterestRate
        ];
        return await deployContractWithProxy(config.deployer, 'CompoundV2EarningPool', args);
    }

    async deployCompoundV3EarningPool(config: IConfig, earningTokenAddress: string): Promise<Contract> {
        const systemConfig = config.systemConfig;
        const args = [
            systemConfig.cometAddress,
            earningTokenAddress,
            systemConfig.maxPerUserDeposit,
            systemConfig.maxInterestRate
        ];
        return await deployContractWithProxy(config.deployer, 'CompoundV3EarningPool', args);
    }
}
