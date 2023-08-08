import fs from 'fs';
import { Contract, Signer } from 'ethers';
import { ethers, upgrades, artifacts } from 'hardhat';
const cachePath = './.deploy-cache.json';

function load(path: string): any {
  if (!fs.existsSync(path)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function write(cache: any, path: string) {
  fs.writeFileSync(path, JSON.stringify(cache, null, 2));
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function cacheDeployContract(deployer: Signer, contractName: string, callback: () => Promise<Contract>): Promise<Contract> {
  const json = load(cachePath);

  if (json[contractName] !== undefined) {
    console.log(`Contract \x1b[33m${contractName}\x1b[0m already deployed to \x1b[33m${json[contractName]}\x1b[0m`);
    const artifact = await artifacts.readArtifact(contractName);
    return new Contract(json[contractName], artifact.abi, deployer);
  }

  const contract = await callback();
  const contractAddr = await contract.getAddress();
  console.log(`Deployed contract \x1b[33m${contractName}\x1b[0m to address: \x1b[33m${contractAddr}\x1b[0m`);
  json[contractName] = contractAddr;
  write(json, cachePath);

  await delay(40_000);
  return contract;
}

export async function deployContractWithProxy(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  return await cacheDeployContract(deployer, contractName, async () => {
    console.log(`Deploy contract: ${contractName} with args:`, ...args);

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await upgrades.deployProxy(contractFactory, args);
    
    fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);
    return contract;
  });
}

export async function deployContract(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  return await cacheDeployContract(deployer, contractName, async () => {
    console.log(`deploy contract: ${contractName} with args:`, ...args);

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await contractFactory.deploy(...args);

    fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);
    return contract;
  })
}
