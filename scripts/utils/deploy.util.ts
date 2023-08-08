import fs from 'fs';
import { Contract, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';

export async function deployContractWithProxy(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  console.log(`Deploy contract: ${contractName} with args:`, ...args);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await upgrades.deployProxy(contractFactory, args);
  fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);

  console.log(`contract \x1b[33m${contractName}\x1b[0m deployed with address \x1b[33m${await contract.getAddress()}\x1b[0m`);
  return contract;
}

export async function deployContract(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  console.log(`deploy contract: ${contractName} with args:`, ...args);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await contractFactory.deploy(...args);
  fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);

  console.log(`contract \x1b[33m${contractName}\x1b[0m deployed with address \x1b[33m${await contract.getAddress()}\x1b[0m`);
  return contract;
}
