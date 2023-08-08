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

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.GOERLI_TESTNET_DEPLOYER_API_KEY}`,
      chainId: 5,
      // gasPrice: 30_000_000_000,
      accounts: [`0x${process.env.GOERLI_TESTNET_DEPLOYER_PRIVATE_KEY}`],
    }
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  etherscan: {
    apiKey: process.env.SCAN_API_KEY,
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
