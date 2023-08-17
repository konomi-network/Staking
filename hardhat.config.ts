import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// output contract size
import 'hardhat-contract-sizer';

// proxy
import '@openzeppelin/hardhat-upgrades';

// load .env config
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, './.env') });

/* note: boolean environment variables are imported as strings */
const {
  NETWORK = '',
  DEPLOYER_PRIVATE_KEY,

  ETHERSCAN_KEY = '',
  ARBISCAN_KEY = '',

  ETH_GOERLI_TESTNET_DEPLOYER_API_KEY,
  ETH_SEPOLIA_TESTNET_DEPLOYER_API_KEY,
  ARB_GOERLI_TESTNET_DEPLOYER_API_KEY
} = process.env;

const chainIds: {[key: string]:number} = {
  'ethereum': 1,
  'ethereum-goerli': 5,
  'ethereum-sepolia': 11155111,

  'arbitrum': 42161,
  'arbitrum-goerli': 421613,
}

const solidityVersions: {[key: string]:string} = {
  'arbitrum': '0.8.19',
  'arbitrum-goerli': '0.8.9',
}

const solidityVersion = solidityVersions[NETWORK] ? solidityVersions[NETWORK] : '0.8.21';
console.log(`Chain: ${NETWORK}[${chainIds[NETWORK]}] solidity version: ${solidityVersion}`)

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
    },
    'ethereum-goerli': {
      url: `https://eth-goerli.g.alchemy.com/v2/${ETH_GOERLI_TESTNET_DEPLOYER_API_KEY}`,
      chainId: chainIds["ethereum-goerli"],
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
    'ethereum-sepolia': {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ETH_SEPOLIA_TESTNET_DEPLOYER_API_KEY}`,
      chainId: chainIds["ethereum-sepolia"],
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
    'arbitrum-goerli': {
      url: `https://arb-goerli.g.alchemy.com/v2/${ARB_GOERLI_TESTNET_DEPLOYER_API_KEY}`,
      chainId: chainIds["arbitrum-goerli"],
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    }
  },
  solidity: {
    version: solidityVersion,
    settings: {
      optimizer: {
        enabled: true,
        runs: 10_000,
      },
    },
  },
  etherscan: {
    apiKey: {
      // Ethereum
      mainnet: ETHERSCAN_KEY,
      // Arbitrum
      arbitrum: ARBISCAN_KEY,
      'arbitrum-goerli': ARBISCAN_KEY,
    },
    customChains: [
      {
        // Hardhat's Etherscan plugin calls the network `arbitrumOne`, so we need to add an entry for our own network name
        network: 'arbitrum',
        chainId: chainIds["arbitrum"],
        urls: {
          apiURL: 'https://api.arbiscan.io/api',
          browserURL: 'https://arbiscan.io/'
        }
      },
      {
        // Hardhat's Etherscan plugin calls the network `arbitrumGoerli`, so we need to add an entry for our own network name
        network: 'arbitrum-goerli',
        chainId: chainIds["arbitrum-goerli"],
        urls: {
          apiURL: 'https://api-goerli.arbiscan.io/api',
          browserURL: 'https://goerli.arbiscan.io/'
        }
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  contractSizer: {
    disambiguatePaths: true,
    runOnCompile: true,
    strict: true
  }
};

export default config;
