import {
    expect
} from 'chai';
import {
    Contract,
    Signer
} from 'ethers';
import {
    ethers,
} from 'hardhat';
import {
    deployContractWithDeployer,
    deployContractWithProxyDeployer
} from './utils';
import {
    MockERC20__factory,
} from '../typechain-types/factories/contracts/test';
import {
    CompoundV3EarningPool__factory,
} from '../typechain-types/factories/contracts/earning';
import { CompoundV3EarningPool } from '../typechain-types/contracts/earning/CompoundV3EarningPool';

// platform fee, i.e. 1000 represents 1%
const PLATFORM_FEE = 1000;
const MAX_PER_USER_DEPOSIT = expandTo18Decimals(100000);
const TEST_AMOUNT = expandTo18Decimals(10000);
const MAX_INTEREST_RATE = 1000;

function expandTo18Decimals(n: number): bigint {
    return BigInt(n) * (10n ** 18n);
}

const calcFee = (amount: number) => {
    return amount * PLATFORM_FEE / 10000;
}

describe("CompoundV3EarningPool", function () {
    let tokenUsdc: Contract;

    let tokenComet: Contract;

    let compoundV3EarningPool: CompoundV3EarningPool;

    let deployer: Signer;
    let sender: Signer;

    const transferToken = async(token: Contract, receiverAddr: string) => {
        const erc20 = MockERC20__factory.connect(await token.getAddress());
        await expect(await erc20.connect(deployer).transfer(receiverAddr, TEST_AMOUNT)).to.emit(token, 'Transfer');
    }

    const allowanceToken = async(runner: Signer, token: Contract, contractAddr: string, checkBalanceOf: boolean = true) => {
        const runnerAddr = await runner.getAddress();

        const erc20 = MockERC20__factory.connect(await token.getAddress());

        await expect(erc20.connect(runner).increaseAllowance(contractAddr, TEST_AMOUNT)).to.emit(token, 'Approval');
        // expect(await token.allowance(runnerAddr, contractAddr)).to.eq(TEST_AMOUNT);

        if (checkBalanceOf) {
            expect(await token.balanceOf(runnerAddr)).to.eq(TEST_AMOUNT);
        }
    }

    const allowanceTokens = async () => {
        const compoundV3EarningPoolAddr = await compoundV3EarningPool.getAddress();
        // await allowanceToken(deployer, tokenUsdc, compoundV3EarningPoolAddr, false);
        await allowanceToken(sender, tokenUsdc, compoundV3EarningPoolAddr);
    }

    beforeEach(async () => {
        [deployer, sender] = await ethers.getSigners();

        const isSilent = true;

        tokenUsdc = await deployContractWithDeployer(deployer, 'MockERC20', ['USDC', 'USDC'], isSilent);

        tokenComet = await deployContractWithDeployer(deployer, 'MockComet', [], isSilent);

        const senderAddr = await sender.getAddress();
        const tokenUsdcAddr = await tokenUsdc.getAddress();
        const tokenCometAddr = await tokenComet.getAddress();

        await transferToken(tokenUsdc, senderAddr);

        const mockCompoundV3EarningPool = await deployContractWithProxyDeployer(
            deployer,
            'CompoundV3EarningPool', 
            [tokenCometAddr, tokenUsdcAddr, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE],
            isSilent);
        compoundV3EarningPool = CompoundV3EarningPool__factory.connect(await mockCompoundV3EarningPool.getAddress(), deployer);

        await compoundV3EarningPool.setInvoker(await sender.getAddress());
    });

    describe('Deposited', () => {
        it('deposit work', async () => {
            await allowanceTokens();

            const senderAddr = await sender.getAddress();
            const contract = compoundV3EarningPool.connect(sender)

            await expect(contract.deposit(senderAddr, 1000n)).to.emit(compoundV3EarningPool, 'Deposited');
        });

        it('deposit failed by DepositAmountMustBeGreaterThanZero', async () => {
            const senderAddr = await sender.getAddress();
            const contract = compoundV3EarningPool.connect(sender)

            await expect(contract.deposit(senderAddr, 0)).to.revertedWithCustomError(compoundV3EarningPool, 'DepositAmountMustBeGreaterThanZero');
        });

        it('deposit reached to DepositReachedMaximumAmountPerUser', async () => {
            const senderAddr = await sender.getAddress();
            const contract = compoundV3EarningPool.connect(sender)

            await expect(contract.deposit(senderAddr, MAX_PER_USER_DEPOSIT + 1n)).to.revertedWithCustomError(compoundV3EarningPool, 'DepositReachedMaximumAmountPerUser');
        });
    });

    describe('Redeemed', () => {
        it('redeem work', async () => {
            await allowanceTokens();

            const senderAddr = await sender.getAddress();
            const contract = compoundV3EarningPool.connect(sender)

            await expect(contract.deposit(senderAddr, 1000n)).to.emit(compoundV3EarningPool, 'Deposited');
            expect(await tokenUsdc.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - 1000n);

            await expect(contract.redeem(senderAddr, 100n)).to.emit(compoundV3EarningPool, 'Redeemed');
            expect(await tokenUsdc.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - 900n);
        });

        it('redeem failed by DepositAmountMustBeGreaterThanZero', async () => {
            const senderAddr = await sender.getAddress();
            const contract = compoundV3EarningPool.connect(sender)

            await expect(contract.redeem(senderAddr, 0)).to.revertedWithCustomError(compoundV3EarningPool, 'RedeemAmountMustBeGreaterThanZero');
        });
    });
});