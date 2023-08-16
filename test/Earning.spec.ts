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
    MockAavePool__factory,
    MockERC20__factory,
    MockCToken__factory,
} from '../typechain-types/factories/contracts/test';
import {
    EarningSwapRouter__factory,
    Earning__factory
} from '../typechain-types/factories/contracts';
import {
    AaveEarningPool__factory,
    CompoundV2EarningPool__factory,
} from '../typechain-types/factories/contracts/earning';
import { MockAavePool } from '../typechain-types/contracts/test/MockAavePool';
import { AaveEarningPool } from '../typechain-types/contracts/earning/AaveEarningPool';
import { CompoundV2EarningPool } from '../typechain-types/contracts/earning/CompoundV2EarningPool';
import { EarningSwapRouter } from '../typechain-types/contracts/EarningSwapRouter';

// platform fee, i.e. 1000 represents 1%
const PLATFORM_FEE = 1000;
const MIN_DEPOSIT_AMOUNT = 100n;
const MAX_PER_USER_DEPOSIT = expandTo18Decimals(100000);
const TEST_AMOUNT = expandTo18Decimals(10000);
const MAX_INTEREST_RATE = 1000;
const MAX_EARNING_PER_USER = 500;

function expandTo18Decimals(n: number): bigint {
    return BigInt(n) * (10n ** 18n);
}

const advanceBlocks = async (blockNumber: number) => {
    while (blockNumber > 0) {
        blockNumber--;
        await ethers.provider.send('evm_mine', []);
    }
};

const calcFee = (amount: number) => {
    return amount * PLATFORM_FEE / 10000;
}

describe("Earning", function () {
    let token: Contract;
    let tokenEth: Contract;
    let tokenLink: Contract;
    let tokenAave: Contract;
    let tokenCompound: Contract;

    let aaveEarningPool: AaveEarningPool;
    let compoundV2EarningPool: CompoundV2EarningPool;

    let aavePool: MockAavePool;

    let earningSwapRouter: EarningSwapRouter;
    let universalRouterContract: Contract;
    let permit2Contract: Contract;

    let toTestContract: Contract;

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
        expect(await token.allowance(runnerAddr, contractAddr)).to.eq(TEST_AMOUNT);

        if (checkBalanceOf) {
            expect(await token.balanceOf(runnerAddr)).to.eq(TEST_AMOUNT);
        }
    }

    const transferTokens = async () => {
        const senderAddr = await sender.getAddress();

        await transferToken(token, senderAddr);
        await transferToken(tokenEth, senderAddr);
        await transferToken(tokenLink, senderAddr);
        
        const testContractAddr = await toTestContract.getAddress();
        await allowanceToken(sender, token, testContractAddr);
        await allowanceToken(sender, tokenEth, testContractAddr);
        await allowanceToken(sender, tokenLink, testContractAddr);
        
        const universalRouterAddr = await universalRouterContract.getAddress();
        await transferToken(tokenEth, universalRouterAddr);
        await transferToken(tokenLink, universalRouterAddr);
        await allowanceToken(sender, tokenEth, universalRouterAddr);
        await allowanceToken(sender, tokenLink, universalRouterAddr);

        const earningSwapRouterContractAddr = await earningSwapRouter.getAddress();
        await allowanceToken(sender, token, earningSwapRouterContractAddr);
        await allowanceToken(sender, tokenEth, earningSwapRouterContractAddr);
        await allowanceToken(sender, tokenLink, earningSwapRouterContractAddr);

        const aaveEarningPoolContractAddr = await aaveEarningPool.getAddress();
        await allowanceToken(deployer, tokenEth, aaveEarningPoolContractAddr, false);
        await allowanceToken(sender, tokenEth, aaveEarningPoolContractAddr);

        const compoundV2EarningPoolContractAddr = await compoundV2EarningPool.getAddress();
        await allowanceToken(deployer, tokenLink, compoundV2EarningPoolContractAddr, false);
        await allowanceToken(sender, tokenLink, compoundV2EarningPoolContractAddr);
    }

    beforeEach(async () => {
        [deployer, sender] = await ethers.getSigners();

        const isSilent = true;
        const mockErc20ContractName = 'MockERC20';
        token = await deployContractWithDeployer(deployer, mockErc20ContractName, ['USDA', 'USDA'], isSilent);
        tokenEth = await deployContractWithDeployer(deployer, mockErc20ContractName, ['ETH', 'ETH'], isSilent);
        tokenLink = await deployContractWithDeployer(deployer, mockErc20ContractName, ['LINK', 'LINK'], isSilent);
        tokenAave = await deployContractWithProxyDeployer(deployer, 'MockAToken', ['AAVE ERC20', 'aERC20'], isSilent);
        tokenCompound = await deployContractWithDeployer(deployer, 'MockCToken', [], isSilent);

        universalRouterContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);
        permit2Contract = await deployContractWithDeployer(deployer, 'MockPermit2', [], isSilent);

        const tokenAddr = await token.getAddress();
        const tokenEthAddr = await tokenEth.getAddress();
        const tokenLinkAddr = await tokenLink.getAddress();

        const universalRouterAddr = await universalRouterContract.getAddress();
        const permit2Addr = await permit2Contract.getAddress();

        const mockEarningSwapRouter = await deployContractWithProxyDeployer(deployer, 'EarningSwapRouter', [
            universalRouterAddr,
            permit2Addr
        ], isSilent);
        earningSwapRouter = EarningSwapRouter__factory.connect(await mockEarningSwapRouter.getAddress(), deployer);
        const earningSwapRouterContractAddress = await earningSwapRouter.getAddress();

        const mockAavePool = await deployContractWithDeployer(deployer, 'MockAavePool', [], isSilent);
        aavePool = MockAavePool__factory.connect(await mockAavePool.getAddress(), deployer);
        const aavePoolAddr = await aavePool.getAddress();

        const tokenAaveAddr = await tokenAave.getAddress();
        const tokenCompoundAddr = await tokenCompound.getAddress();

        await aavePool.addAToken(tokenAddr, tokenAaveAddr);
        await aavePool.addAToken(tokenEthAddr, tokenAaveAddr);
        await aavePool.addAToken(tokenLinkAddr, tokenAaveAddr);

        const mockAaveEarningPool = await deployContractWithProxyDeployer(
            deployer,
            'AaveEarningPool', 
            [aavePoolAddr, tokenAaveAddr, tokenEthAddr, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE],
            isSilent);
        aaveEarningPool = AaveEarningPool__factory.connect(await mockAaveEarningPool.getAddress(), deployer);
        const ethEarningPoolContractAddr = await aaveEarningPool.getAddress();

        const mockCompoundV2EarningPool = await deployContractWithProxyDeployer(
            deployer,
            'CompoundV2EarningPool', 
            [tokenCompoundAddr, tokenLinkAddr, MAX_PER_USER_DEPOSIT, MAX_INTEREST_RATE],
            isSilent);
        compoundV2EarningPool = CompoundV2EarningPool__factory.connect(await mockCompoundV2EarningPool.getAddress(), deployer);
        const linkEarningPoolContractAddr = await compoundV2EarningPool.getAddress();

        const DEFAULT_COMBOS = [{
                creditRating: 0,
                entries: [{
                        weight: 30,
                        earning: {
                            id: 0,
                            name: 'ETH',
                            token: await tokenEth.getAddress(),
                            earningContract: ethEarningPoolContractAddr,
                        }
                    },
                    {
                        weight: 70,
                        earning: {
                            id: 1,
                            name: 'LINK',
                            token: await tokenLink.getAddress(),
                            earningContract: linkEarningPoolContractAddr,
                        }
                    }
                ]
            },
            {
                creditRating: 1,
                entries: [{
                        weight: 60,
                        earning: {
                            id: 10,
                            name: 'sETH',
                            token: await tokenEth.getAddress(),
                            earningContract: ethEarningPoolContractAddr,
                        }
                    },
                    {
                        weight: 40,
                        earning: {
                            id: 11,
                            name: 'sLINK',
                            token: await tokenLink.getAddress(),
                            earningContract: linkEarningPoolContractAddr,
                        }
                    }
                ]
            }
        ]

        toTestContract = await deployContractWithProxyDeployer(
            deployer,
            'Earning',
            [tokenAddr, PLATFORM_FEE, earningSwapRouterContractAddress, MAX_PER_USER_DEPOSIT, MIN_DEPOSIT_AMOUNT, DEFAULT_COMBOS],
            isSilent,
        );

        await aaveEarningPool.setInvoker(await toTestContract.getAddress());
        await compoundV2EarningPool.setInvoker(await toTestContract.getAddress());
        await earningSwapRouter.setInvoker(await toTestContract.getAddress());
    });

    describe('SetEnv', () => {
        it('setSwapRouter work', async () => {
            const testContractAddr = await toTestContract.getAddress();
            const earningSwapRouterAddr = await earningSwapRouter.getAddress();

            const contract = Earning__factory.connect(testContractAddr, deployer);

            await expect(contract.setSwapRouter(earningSwapRouterAddr)).to.emit(contract, 'UpdatedSwapRouter');
        });

        it('setSwapRouter missing role', async () => {
            const testContractAddr = await toTestContract.getAddress();
            const earningSwapRouterAddr = await earningSwapRouter.getAddress();

            const contract = Earning__factory.connect(testContractAddr, sender);

            await expect(contract.setSwapRouter(earningSwapRouterAddr)).to.rejectedWith(/AccessControl: account .* is missing role .*/);
        });

        it('setMaxPerUserDeposit work', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const contract = Earning__factory.connect(testContractAddr, deployer);

            await expect(contract.setMaxPerUserDeposit(MIN_DEPOSIT_AMOUNT + 1n)).to.emit(contract, 'UpdatedMaxPerUserDeposit');

            await expect(contract.deposit(0, MAX_PER_USER_DEPOSIT)).to.be.revertedWithCustomError(contract, 'DepositReachedMaximumAmountPerUser');
        });

        it('setMaxPerUserDeposit missing role', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const contract = Earning__factory.connect(testContractAddr, sender);

            await expect(contract.setMaxPerUserDeposit(1n)).to.rejectedWith(/AccessControl: account .* is missing role .*/);
        });

        it('setMinDepositAmount work', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const contract = Earning__factory.connect(testContractAddr, deployer);

            await expect(contract.setMinDepositAmount(MAX_PER_USER_DEPOSIT - 100n)).to.emit(contract, 'UpdateMinDepositAmount');

            await expect(contract.deposit(0, 100n)).to.be.revertedWithCustomError(contract, 'DepositMustBeExceedMinimumAmount');
        });

        it('setMinDepositAmount missing role', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const contract = Earning__factory.connect(testContractAddr, sender);

            await expect(contract.setMinDepositAmount(1n)).to.rejectedWith(/AccessControl: account .* is missing role .*/);
        });
    });

    describe('Deposited', () => {
        it('deposit but not enough', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);

            const tx = earningContract.connect(sender).deposit(0, MIN_DEPOSIT_AMOUNT - 1n);
            await expect(tx).to.be.revertedWithCustomError(earningContract, 'DepositMustBeExceedMinimumAmount');
        });

        it('deposit but earning id not exist', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);

            const tx = earningContract.connect(sender).deposit(99, MIN_DEPOSIT_AMOUNT);
            await expect(tx).to.be.revertedWithCustomError(earningContract, 'EarningIdNotExist');
        });

        it('deposit but earning ended', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);

            await earningContract.connect(deployer).endEarning();

            const tx = earningContract.connect(sender).deposit(0, MIN_DEPOSIT_AMOUNT);
            await expect(tx).to.be.revertedWithCustomError(earningContract, 'EarningEnded');
        });

        it('deposit but reached MAX_PER_USER_DEPOSIT', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);

            const tx = earningContract.connect(sender).deposit(0, MAX_PER_USER_DEPOSIT + 1n);
            await expect(tx).to.be.revertedWithCustomError(earningContract, 'DepositReachedMaximumAmountPerUser');
        });

        // Too long run time
        // it('deposit but reached MAX_EARNING_PER_USER', async () => {
        //     await transferTokens();

        //     const testContractAddr = await toTestContract.getAddress();

        //     const earningContract = Earning__factory.connect(testContractAddr);
        //     const connect = earningContract.connect(sender);

        //     for (let i = 0; i < MAX_EARNING_PER_USER; i++) {
        //         console.log('>>> deposit:', i);
        //         await expect(connect.deposit(0, MIN_DEPOSIT_AMOUNT)).to.emit(toTestContract, 'Deposited');
        //     }

        //     const tx = connect.deposit(0, 100);
        //     await expect(tx).to.be.revertedWithCustomError(earningContract, 'DepositReachedMaximumNumberPerUser');
        // });

        it('deposit with 1000 and 2000', async () => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const universalRouterAddr = await universalRouterContract.getAddress();

            expect(await tokenEth.balanceOf(universalRouterAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(universalRouterAddr)).to.eq(TEST_AMOUNT);

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(sender);

            let amount = 1000n;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await token.balanceOf(testContractAddr)).to.eq(100n);
            expect(await tokenEth.balanceOf(universalRouterAddr) + BigInt(300 - calcFee(300))).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(universalRouterAddr) + BigInt(700 - calcFee(700))).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            await expect(connect.deposit(1, 2000)).to.emit(toTestContract, 'Deposited');

            const userDetail = await connect.listUserEarnDetail();
            expect(userDetail.length).to.eq(4);

            expect(userDetail[0].earningId).to.eq(0);
            expect(userDetail[0].amount).to.eq(300 - calcFee(300));

            expect(userDetail[1].earningId).to.eq(1);
            expect(userDetail[1].amount).to.eq(700 - calcFee(700));

            expect(userDetail[2].earningId).to.eq(10);
            expect(userDetail[2].amount).to.eq(1200 - calcFee(1200));

            expect(userDetail[3].earningId).to.eq(11);
            expect(userDetail[3].amount).to.eq(800 - calcFee(800));
        });
    });

    describe('Combo add and remove test', () => {
        const makeCombo = async (i: number) => {
            const ethEarningPoolContractAddr = await aaveEarningPool.getAddress();
            const linkEarningPoolContractAddr = await compoundV2EarningPool.getAddress();
            return {
                creditRating: 0,
                entries: [{
                        weight: 70,
                        earning: {
                            id: i,
                            name: 'ETH' + i,
                            token: await tokenEth.getAddress(),
                            earningContract: ethEarningPoolContractAddr,
                        }
                    },
                    {
                        weight: 30,
                        earning: {
                            id: i + 1,
                            name: 'LINK' + i,
                            token: await tokenLink.getAddress(),
                            earningContract: linkEarningPoolContractAddr,
                        }
                    }
                ]
            }
        }
        
        it('addCombo work', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(deployer);

            const combo = await makeCombo(20);
            await expect(connect.addCombo(combo)).to.emit(toTestContract, 'AddedCombo');
        });

        it('addCombo revert EarningConfigIncorrectWeight', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(deployer);

            const ethEarningPoolContractAddr = await aaveEarningPool.getAddress();
            const linkEarningPoolContractAddr = await compoundV2EarningPool.getAddress();

            const errorCombo = {
                creditRating: 4,
                entries: [{
                        weight: 60,
                        earning: {
                            id: 20,
                            name: 'ETH',
                            token: await tokenEth.getAddress(),
                            earningContract: ethEarningPoolContractAddr,
                        }
                    },
                    {
                        weight: 20,
                        earning: {
                            id: 21,
                            name: 'LINK',
                            token: await tokenLink.getAddress(),
                            earningContract: linkEarningPoolContractAddr,
                        }
                    }
                ]
            }
            await expect(connect.addCombo(errorCombo)).to.revertedWithCustomError(earningContract, 'EarningConfigIncorrectWeight');
        });

        it('addCombo revert EarningConfigReachedMaximumAmount', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(deployer);

            const size = 255;
            for (let i = 2; i < size; i++) {
                const combo = await makeCombo(i * 10);
                await expect(connect.addCombo(combo)).to.emit(toTestContract, 'AddedCombo');
            }

            const combos = await connect.listAllCombos();
            expect(combos.length).to.eq(size);

            await expect(connect.addCombo(await makeCombo(255))).to.revertedWithCustomError(earningContract, 'EarningConfigReachedMaximumAmount');
        });

        it('removeCombo work', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(deployer);

            let combos = await connect.listAllCombos();
            expect(combos.length).to.eq(2);

            await expect(connect.removeCombo(99)).to.revertedWithCustomError(earningContract, 'EarningIdNotExist');
            await expect(connect.removeCombo(1)).to.emit(toTestContract, 'RemovedCombo');

            combos = await connect.listAllCombos();
            expect(combos.length).to.eq(1);
        });
    });

    describe('AverageAPY', () => {
        it('averageAPY work', async() => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(sender);

            const amount = 500n;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);

            const cToken = MockCToken__factory.connect(await tokenCompound.getAddress());

            expect(await connect.averageAPY(0)).to.eq(314);

            await advanceBlocks(10);
            // mock dynamic change AP*
            await cToken.connect(deployer).mockN(2);
            await aavePool.connect(deployer).mockN(2);
            expect(await connect.averageAPY(0)).to.eq(399);

            await aaveEarningPool.connect(deployer).setMaxInterestRate(100);
            expect(await connect.averageAPY(0)).to.eq(365);

            await compoundV2EarningPool.setMaxInterestRate(100);
            expect(await connect.averageAPY(0)).to.eq(50);

            await expect(compoundV2EarningPool.setMaxPerUserDeposit(100)).to.emit(compoundV2EarningPool, 'UpdatedMaxPerUserDeposit');
        });

        it('averageAPY but earning id not exist', async() => {
            const testContractAddr = await toTestContract.getAddress();
            const earningContract = Earning__factory.connect(testContractAddr);

            const tx = earningContract.connect(sender).averageAPY(99);
            await expect(tx).to.revertedWithCustomError(earningContract, 'EarningIdNotExist');
        });
    })

    describe('Redeem', () => {
        it('redeem work', async() => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const tokenEthAddr = await tokenEth.getAddress();
            const tokenLinkAddr = await tokenLink.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);

            const SUPPLY_AMOUNT = 1000;
            await expect(earningContract.connect(deployer).supplyReward(0, SUPPLY_AMOUNT)).to.emit(toTestContract, 'RewardPumped');
            await expect(earningContract.connect(deployer).supplyReward(1, SUPPLY_AMOUNT)).to.emit(toTestContract, 'RewardPumped');
            await expect(earningContract.connect(deployer).supplyReward(99, SUPPLY_AMOUNT)).to.revertedWithCustomError(earningContract, 'EarningConfigContractNotExist');

            const connect = earningContract.connect(sender);

            const amount = 1000n;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            await advanceBlocks(10);
            const ethAmount = BigInt(300 - calcFee(300));
            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, tokenEthAddr, ethAmount, 0);
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr) - ethAmount).to.eq(TEST_AMOUNT);

            let userDetail = await connect.listUserEarnDetail();
            expect(userDetail.length).to.eq(1);

            const linkAmount = BigInt(700 - calcFee(700));
            expect(userDetail[0].earningId).to.eq(1);
            expect(userDetail[0].amount).to.eq(linkAmount);

            await expect(connect.redeem(1)).to.revertedWithCustomError(earningContract, 'EarningIdNotExist');

            // too long wait
            // await advanceBlocks(1000000);
            // await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, tokenLinkAddr, linkAmount, 1);

            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, tokenLinkAddr, linkAmount, 0);
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(senderAddr) - linkAmount).to.eq(TEST_AMOUNT);

            userDetail = await connect.listUserEarnDetail();
            expect(userDetail.length).to.eq(0);

            await expect(connect.redeem(0)).to.revertedWithCustomError(earningContract, 'EarningIsEmpty');
        });
    })
});