import {
    Contract,
    Signer} from 'ethers';
import {
    ethers,
    upgrades
} from 'hardhat';

export function expandTo18Decimals(n: number): bigint {
    return BigInt(n) * (10n ** 18n);
}

export async function deployContractWithDeployer(
    deployer: Signer,
    contractName: string,
    args: unknown[],
    isSilent?: boolean,
): Promise<Contract> {
    if (!isSilent) {
        console.log(`>>> deploy contract: ${contractName} with (${args.length}) args:`, ...args);
    }

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await contractFactory.deploy(...args);
    const contractAddr = await contract.getAddress();

    if (!isSilent) {
        console.log(`>> contract ${contractName} deployed with address ${contractAddr}`);
    }
    return contract;
}

export async function deployContractWithProxyDeployer(
    deployer: Signer,
    contractName: string,
    args: unknown[],
    isSilent?: boolean,
): Promise<Contract> {
    if (!isSilent) {
        console.log(`>>> deploy contract: ${contractName} with (${args.length}) args:`, ...args);
    }

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await upgrades.deployProxy(contractFactory, args, { kind: 'uups' });

    if (!isSilent) {
        console.log(`>> contract ${contractName} deployed with address ${await contract.getAddress()}`);
    }
    return contract;
}