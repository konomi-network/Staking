import {
    Contract, Signer
} from 'ethers';
import { ethers } from 'hardhat';

export async function deployContractWithDeployer(
    deployer: Signer,
    contractName: string,
    args: unknown[],
    isSilent ? : boolean,
): Promise<Contract> {
    if (!isSilent) {
        console.log(`>>> deploy contract: ${contractName} with (${args.length}) args:`, ...args);
    }

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await contractFactory.deploy(...args);
    const contractAddr = await contract.getAddress();
    const data = {
        address: contractAddr,
        abi: JSON.parse(contract.interface.formatJson()),
    };
    // fs.writeFileSync(`${__dirname}/generated/${contractName}.json`, JSON.stringify(data));

    if (!isSilent) {
        console.log(`>> contract ${contractName} deployed with address ${contractAddr}`);
    }
    return contract;
}