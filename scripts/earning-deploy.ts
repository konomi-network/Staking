import { ethers } from 'hardhat';
import Web3 from 'web3';
import { Web3Account } from 'web3-eth-accounts';
import {
    loadWalletFromEncryptedJson,
    loadWalletFromPrivate,
    readPassword,
    deployContractWithProxy
} from './utils/deploy.util';

import {
    makeCombos,
    ethTokenAddress,
    linkTokenAddress
} from './dev.env'

const CONTRACT_NAME = 'Earning';

async function main() {
    try {
        const earningTokenAddress = process.env.EARNING_TOKEN_ADDRESS;
        const uniswapRouterAddress = process.env.UNISWAP_ROUTER_ADDRESS;
        const aavePoolAddress = process.env.AAVE_POOL_ADDRESS;
        const aTokenAddress = process.env.ATOKEN_ADDRESS;

        const encryptedAccountJson = process.env.ENCRYPTED_JSON;
        const privateKey = process.env.PRIVATE_KEY;

        const nodeUrl = 'https://speedy-nodes-nyc.moralis.io/60614a4a4c0005c53c56e794/bsc/mainnet';
        const web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));

        let account: Web3Account;
        if (encryptedAccountJson) {
            const pw = await readPassword();
            account = await loadWalletFromEncryptedJson(encryptedAccountJson, pw, web3);
        } else if (privateKey) {
            account = loadWalletFromPrivate(privateKey, web3);
        } else {
            throw Error('Cannot setup account');
        }

        const provider = new ethers.JsonRpcProvider(nodeUrl);
        const deployer = new ethers.Wallet(account.privateKey, provider);
        console.log(`Deploying contracts with account: ${await deployer.getAddress()}`);

        const PLATFORM_FEE = 1000; // 1%
        const MAX_PER_USER_DEPOSIT = 10000;
        const MIN_DEPOSIT_AMOUNT = 1000;

        const deployEarningPool = async(earningTokenAddress: string): Promise<string> => {
            const contract = await deployContractWithProxy(deployer, 'AaveEarningPool', [
                aavePoolAddress, aTokenAddress, earningTokenAddress, MAX_PER_USER_DEPOSIT
            ]);
            return await contract.getAddress();
        }
        
        const ethEarningPoolContractAddress = await deployEarningPool(ethTokenAddress);
        const linkEarningPoolContractAddress = await deployEarningPool(linkTokenAddress);

        await deployContractWithProxy(deployer, CONTRACT_NAME, [
            earningTokenAddress,
            PLATFORM_FEE,
            uniswapRouterAddress,
            MAX_PER_USER_DEPOSIT,
            MIN_DEPOSIT_AMOUNT,
            makeCombos(ethEarningPoolContractAddress, linkEarningPoolContractAddress)
        ]);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();