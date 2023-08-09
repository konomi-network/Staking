import { ethers, network } from 'hardhat';
import { Web3 } from 'web3';
import { UpgradeContract } from './utils/deploy.util';

const CONTRACT_NAME = 'Earning';

async function main() {
    try {
        const startTime = `Deploy contract to \x1b[33m${network.name}\x1b[0m network`;
        console.time(startTime);

        const env = require(`./networks/${network.name}`)
        const [deployer] = await ethers.getSigners();
        console.log(`Deploying contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const web3 = new Web3(network.provider);
        console.log('Before balance:', web3.utils.fromWei(await web3.eth.getBalance(await deployer.getAddress()), 'ether'));

        const oldContractAddress = '0x562c3078e2b6C5b65142248F918ba19b7Eb35e40';
        await UpgradeContract(deployer, CONTRACT_NAME, oldContractAddress);

        console.log('After balance:', web3.utils.fromWei(await web3.eth.getBalance(await deployer.getAddress()), 'ether'));
        console.timeEnd(startTime);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();