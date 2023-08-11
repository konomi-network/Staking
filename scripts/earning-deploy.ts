import { network } from 'hardhat';
import { Contract } from 'ethers';
import { tryExecute, deployContractWithProxy, loadSystemConfig } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        const env = require(`./networks/${network.name}`)

        console.log(`Deploying contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const config = await env.makeConfig();
        const systemConfig = await loadSystemConfig();

        const deployAaveEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            const args = [
                systemConfig.aavePoolAddress,
                systemConfig.aTokenAddress,
                earningTokenAddress,
                systemConfig.maxPerUserDeposit,
                systemConfig.maxInterestRate
            ];
            return await deployContractWithProxy(deployer, 'AaveEarningPool', args);
        }

        const deployCompoundEarningPool = async(earningTokenAddress: string): Promise<Contract> => {
            const args = [
                systemConfig.cTokenAddress,
                earningTokenAddress,
                systemConfig.maxPerUserDeposit,
                systemConfig.maxInterestRate
            ];
            return await deployContractWithProxy(deployer, 'CompoundEarningPool', args);
        }
        
        const earningPoolContracts = await env.deployEarningPoolContracts(config, deployAaveEarningPool, deployCompoundEarningPool);

        const combos = await env.makeCombos(config, earningPoolContracts);

        const contract = await deployContractWithProxy(deployer, 'Earning', [
            systemConfig.earningTokenAddress,
            systemConfig.platformFee,
            systemConfig.uniswapRouterAddress,
            systemConfig.maxPerUserDeposit,
            systemConfig.minDepositAmount,
            combos
        ]);

        for (const key of Object.keys(earningPoolContracts)) {
            try {
                await earningPoolContracts[key].setInvoker(await contract.getAddress());
            } catch (error) {
                console.error(`${key} setInvoker failed by ${error}`)
            }
        }
    });
}

main();