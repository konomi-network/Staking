import { UpgradeContract, tryExecute } from './utils/deploy.util';

async function main() {
    await tryExecute(async (deployer) => {
        console.log(`Upgrading contracts with account: \x1b[33m${await deployer.getAddress()}\x1b[0m`);

        const oldContractAddress = '0x430bc2C4C897a00B77fDdc9a842c19eEd0d0B991';
        await UpgradeContract(deployer, 'Earning', oldContractAddress);
    });
}

main();