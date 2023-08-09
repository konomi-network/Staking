import fs from 'fs';
import { Contract, Signer } from 'ethers';
import { ethers, upgrades, artifacts, network } from 'hardhat';

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

export async function cacheDeployContract(deployer: Signer, contractName: string, args: any[],
  callback: (args: any[]) => Promise<Contract>): Promise<Contract> {
  const cachePath = `./.deploy-cache.${network.name}.json`;

  const json = load(cachePath);
  const cacheName = [contractName, ...args].join('|');

  if (json[cacheName] !== undefined) {
    console.log(`Contract \x1b[33m${contractName}\x1b[0m already deployed to \x1b[33m${json[cacheName]}\x1b[0m`);
    const artifact = await artifacts.readArtifact(contractName);
    return new Contract(json[cacheName], artifact.abi, deployer);
  }

  const contract = await callback(args);
  const contractAddr = await contract.getAddress();
  console.log(`Deployed contract \x1b[33m${contractName}\x1b[0m to address: \x1b[33m${contractAddr}\x1b[0m`);
  json[cacheName] = contractAddr;
  write(json, cachePath);

  await delay(40_000);
  return contract;
}

export async function deployContractWithProxy(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  return await cacheDeployContract(deployer, contractName, args, async (args) => {
    console.log(`Deploy contract: ${contractName} with args:`, ...args);

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await upgrades.deployProxy(contractFactory, args, { kind: 'uups' });
    
    fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);
    return contract;
  });
}

export async function deployContract(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  return await cacheDeployContract(deployer, contractName, args, async (args) => {
    console.log(`deploy contract: ${contractName} with args:`, ...args);

    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await contractFactory.deploy(...args);

    fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);
    return contract;
  })
}

export async function UpgradeContract(deployer: Signer, contractName: string, oldContractAddress: string): Promise<Contract> {
  console.log(`Upgrading contract: \x1b[33m${contractName}\x1b[0m with old address: \x1b[33m${oldContractAddress}\x1b[0m`);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await upgrades.upgradeProxy(oldContractAddress, contractFactory, { kind: 'uups' });

  console.log(`Upgraded contract \x1b[33m${contractName}\x1b[0m to address: \x1b[33m${await contract.getAddress()}\x1b[0m`);
  return contract;
}
