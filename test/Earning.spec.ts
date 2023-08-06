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
    Earning__factory
} from '../typechain-types/factories/contracts';

// platform fee, i.e. 1000 represents 1%
const PLATFORM_FEE = 1000;
const MIN_DEPOSIT_AMOUNT = 100n;
const MAX_PER_USER_DEPOSIT = expandTo18Decimals(100000);
const TEST_AMOUNT = expandTo18Decimals(10000);

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

    let ethEarningPoolContract: Contract;
    let linkEarningPoolContract: Contract;

    let aavePoolContract: Contract;

    let swapRouterContract: Contract;

    let toTestContract: Contract;

    let deployer: Signer;
    let sender: Signer;
    let invoker: Signer;

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
        
        const uniswapRouterAddr = await swapRouterContract.getAddress();
        await transferToken(tokenEth, uniswapRouterAddr);
        await transferToken(tokenLink, uniswapRouterAddr);

        await allowanceToken(sender, tokenEth, uniswapRouterAddr);
        await allowanceToken(sender, tokenLink, uniswapRouterAddr);
        
        const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();
        await allowanceToken(deployer, tokenEth, ethEarningPoolContractAddr, false);
        await allowanceToken(sender, tokenEth, ethEarningPoolContractAddr);

        const linkEarningPoolContractAddr = await linkEarningPoolContract.getAddress();
        await allowanceToken(deployer, tokenLink, linkEarningPoolContractAddr, false);
        await allowanceToken(sender, tokenLink, linkEarningPoolContractAddr);
    }

    beforeEach(async () => {
        [deployer, sender, invoker] = await ethers.getSigners();

        const isSilent = true;
        const mockErc20ContractName = 'MockERC20';
        token = await deployContractWithDeployer(deployer, mockErc20ContractName, ['USDA', 'USDA'], isSilent);
        tokenEth = await deployContractWithDeployer(deployer, mockErc20ContractName, ['ETH', 'ETH'], isSilent);
        tokenLink = await deployContractWithDeployer(deployer, mockErc20ContractName, ['LINK', 'LINK'], isSilent);
        tokenAave = await deployContractWithProxyDeployer(deployer, 'MockAToken', ['AAVE ERC20', 'aERC20'], isSilent);
        tokenCompound = await deployContractWithDeployer(deployer, 'MockCToken', [], isSilent);

        swapRouterContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);

        const tokenAddr = await token.getAddress();
        const tokenEthAddr = await tokenEth.getAddress();
        const tokenLinkAddr = await tokenLink.getAddress();
        const uniswapRouterAddr = await swapRouterContract.getAddress();

        aavePoolContract = await deployContractWithDeployer(deployer, 'MockAavePool', [], isSilent);
        const aavePool = MockAavePool__factory.connect(await aavePoolContract.getAddress(), ethers.provider);
        const aavePoolAddr = await aavePool.getAddress();

        const tokenAaveAddr = await tokenAave.getAddress();
        const tokenCompoundAddr = await tokenCompound.getAddress();

        const aavePoolConnect = aavePool.connect(deployer);
        await aavePoolConnect.addAToken(tokenAddr, tokenAaveAddr);
        await aavePoolConnect.addAToken(tokenEthAddr, tokenAaveAddr);
        await aavePoolConnect.addAToken(tokenLinkAddr, tokenAaveAddr);

        ethEarningPoolContract = await deployContractWithDeployer(
            deployer,
            'AaveEarningPool', 
            [aavePoolAddr, tokenAaveAddr, tokenEthAddr, MAX_PER_USER_DEPOSIT],
            isSilent);
        const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();

        linkEarningPoolContract = await deployContractWithDeployer(
            deployer,
            'CompoundEarningPool', 
            [tokenCompoundAddr, tokenLinkAddr, MAX_PER_USER_DEPOSIT],
            isSilent);
        const linkEarningPoolContractAddr = await linkEarningPoolContract.getAddress();

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

        toTestContract = await deployContractWithDeployer(
            deployer,
            'Earning',
            [],
            isSilent,
        );

        await toTestContract.initialize(tokenAddr, PLATFORM_FEE, uniswapRouterAddr, MAX_PER_USER_DEPOSIT, MIN_DEPOSIT_AMOUNT, DEFAULT_COMBOS);
        await ethEarningPoolContract.initialize(await toTestContract.getAddress());
        await linkEarningPoolContract.initialize(await toTestContract.getAddress());
    });

    describe('Deposited', () => {
        it('deposit but not enough', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(sender);

            const tx = connect.deposit(0, MIN_DEPOSIT_AMOUNT - 1n);
            await expect(tx).to.be.revertedWithCustomError(earningContract, 'DepositMustBeExceedMinimumAmount');
        });

        it('deposit with 1000 and 2000', async () => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const uniswapRouterAddr = await swapRouterContract.getAddress();

            expect(await tokenEth.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT);

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(sender);

            let amount = 1000n;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await token.balanceOf(testContractAddr)).to.eq(amount);
            expect(await tokenEth.balanceOf(uniswapRouterAddr) + BigInt(300 - calcFee(300))).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(uniswapRouterAddr) + BigInt(700 - calcFee(700))).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            await expect(connect.deposit(1, 2000)).to.emit(toTestContract, 'Deposited');

            const userDetail = await connect.listUserEarnDetails(await sender.getAddress());
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
            const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();
            const linkEarningPoolContractAddr = await linkEarningPoolContract.getAddress();
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
            await expect(connect.addCombo(combo)).to.emit(toTestContract, 'AddCombo');
        });

        it('addCombo revert EarningConfigIncorrectWeight', async () => {
            const testContractAddr = await toTestContract.getAddress();

            const earningContract = Earning__factory.connect(testContractAddr);
            const connect = earningContract.connect(deployer);

            const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();
            const linkEarningPoolContractAddr = await linkEarningPoolContract.getAddress();

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
                await expect(connect.addCombo(combo)).to.emit(toTestContract, 'AddCombo');
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
            await expect(connect.removeCombo(1)).to.emit(toTestContract, 'RemoveCombo');

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
            const aavePool = MockAavePool__factory.connect(await aavePoolContract.getAddress());
            // mock number change
            await cToken.connect(deployer).mockN(1);
            await aavePool.connect(deployer).mockN(1);
            expect(await connect.averageAPY(0)).to.eq(314);

            await advanceBlocks(10);
            // mock number change
            await cToken.connect(deployer).mockN(2);
            await aavePool.connect(deployer).mockN(2);
            expect(await connect.averageAPY(0)).to.eq(653);
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

            const connect = earningContract.connect(sender);

            const amount = 1000n;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            const cToken = MockCToken__factory.connect(await tokenCompound.getAddress());
            const aavePool = MockAavePool__factory.connect(await aavePoolContract.getAddress());
            // mock number change
            await cToken.connect(deployer).mockN(1);
            await aavePool.connect(deployer).mockN(1);

            await advanceBlocks(10);
            const ethAmount = BigInt(300 - calcFee(300));
            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, tokenEthAddr, ethAmount, 0);
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr) - ethAmount).to.eq(TEST_AMOUNT);

            let userDetail = await connect.listUserEarnDetails(await sender.getAddress());
            expect(userDetail.length).to.eq(1);

            const linkAmount = BigInt(700 - calcFee(700));
            expect(userDetail[0].earningId).to.eq(1);
            expect(userDetail[0].amount).to.eq(linkAmount);

            await expect(connect.redeem(1)).to.revertedWithCustomError(earningContract, 'EarningIdNotExist');

            // mock number change
            await cToken.connect(deployer).mockN(2);

            await advanceBlocks(100);
            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, tokenLinkAddr, linkAmount, 0);
            expect(await token.balanceOf(senderAddr) + amount).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(senderAddr) - linkAmount).to.eq(TEST_AMOUNT);

            userDetail = await connect.listUserEarnDetails(await sender.getAddress());
            expect(userDetail.length).to.eq(0);

            await expect(connect.redeem(0)).to.revertedWithCustomError(earningContract, 'EarningIsEmpty');
        });
    })
});