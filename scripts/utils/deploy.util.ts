import fs from 'fs';
import Web3 from 'web3';
import { Web3Account } from 'web3-eth-accounts';
import { Contract, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deployContractWithProxy(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  console.log(`>>> deploy contract: ${contractName} with args:`, ...args);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await upgrades.deployProxy(contractFactory, args);
  fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);

  console.log(`>>> contract ${contractName} deployed with address ${await contract.getAddress()}`);
  return contract;
}

export async function deployContract(deployer: Signer, contractName: string, args: unknown[]): Promise<Contract> {
  console.log(`>>> deploy contract: ${contractName} with args:`, ...args);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const contract = await contractFactory.deploy(...args);
  fs.writeFileSync(`/tmp/${contractName}.js`, `module.exports = ${JSON.stringify(args)}`);

  console.log(`>>> contract ${contractName} deployed with address ${await contract.getAddress()}`);
  return contract;
}

/**
 * Load wallet from the encrypted json
 * @param json The path to the json file stored locally
 * @param password The password
 * @param web3 The web3 instance
 */
export async function loadWalletFromEncryptedJson(json: string, password: string, web3: Web3): Promise<Web3Account> {
  const walletEncryptedJson = JSON.parse(fs.readFileSync(json).toString());

  const account = await web3.eth.accounts.decrypt(walletEncryptedJson, password);
  web3.eth.accounts.wallet.add(account);
  return account;
}

/**
 * Load wallet from the private key
 * @param privateKey The private key
 * @param web3 The web3 instance
 */
export function loadWalletFromPrivate(privateKey: string, web3: Web3): Web3Account {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);

  return account;
}

export function readPassword(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.stdoutMuted = true;

  const p: Promise<string> = new Promise(resolve => {
    rl.question('Password: ', function (password: string) {
      rl.close();
      console.log('\n');
      resolve(password);
    });
  });

  rl._writeToOutput = function _writeToOutput(stringToWrite: string) {
    if (rl.stdoutMuted) rl.output.write('*');
    else rl.output.write(stringToWrite);
  };

  rl.history = rl.history.slice(1);

  return p;
}

export const ONE_ETHER = BigInt('1000000000000000000');

export function ensure(predicate: boolean, errorMessage: string): void {
  if (!predicate) {
    throw new Error(errorMessage);
  }
}

export function isBitSet(n: number, offset: number): boolean {
  return ((n >> offset) & 1) === 1;
}
