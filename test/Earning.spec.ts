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
    MockAToken__factory,
    MockAavePool__factory
} from '../typechain-types/factories/contracts/test';

const STAKING_FEE = 1000;
const MIN_DEPOSIT_AMOUNT = 100n;
const MAX_DEPOSIT = expandTo18Decimals(10000000);;
const MAX_PER_USER_DEPOSIT = expandTo18Decimals(100000);
const TEST_AMOUNT = expandTo18Decimals(10000);

function expandTo18Decimals(n: number): BigInt {
    return BigInt(n) * (10n ** 18n);
}

const advanceBlocks = async (blockNumber: number) => {
    while (blockNumber > 0) {
        blockNumber--;
        await ethers.provider.send('evm_mine', []);
    }
};

const calcFee = (amount: number) => {
    return amount * STAKING_FEE / 10000;
}

describe("Earning", function () {
    let token: Contract;
    let tokenEth: Contract;
    let tokenLink: Contract;

    let ethEarningPoolContract: Contract;
    let linkEarningPoolContract: Contract;

    let APoolContract: Contract;
    let ATokenContract: Contract;

    let swapRouterContract: Contract;

    let toTestContract: Contract;

    let deployer: Signer;
    let sender: Signer;
    let invoker: Signer;

    const transferToken = async(token: Contract, receiverAddr: string) => {
        await expect(await token.connect(deployer).transfer(receiverAddr, TEST_AMOUNT)).to.emit(token, 'Transfer');
    }

    const allowanceToken = async(runner: Signer, token: Contract, contractAddr: string, checkBalanceOf: boolean = true) => {
        const runnerAddr = await runner.getAddress();

        await expect(token.connect(runner).increaseAllowance(contractAddr, TEST_AMOUNT)).to.emit(token, 'Approval');
        expect(await token.allowance(runnerAddr, contractAddr)).to.eq(TEST_AMOUNT);

        if (checkBalanceOf) {
            expect(await token.balanceOf(runnerAddr)).to.eq(TEST_AMOUNT);
        }
    }

    const transferTokens = async () => {
        console.log(">>> Init transferTokens");
        const senderAddr = await sender.getAddress();

        await transferToken(token, senderAddr);
        await transferToken(tokenEth, senderAddr);
        await transferToken(tokenLink, senderAddr);
        
        const testContractAddr = await toTestContract.getAddress();
        await allowanceToken(sender, token, testContractAddr);
        
        const uniswapRouterAddr = await swapRouterContract.getAddress();
        await transferToken(tokenEth, uniswapRouterAddr);
        await transferToken(tokenLink, uniswapRouterAddr);

        await allowanceToken(sender, tokenEth, uniswapRouterAddr);
        await allowanceToken(sender, tokenLink, uniswapRouterAddr);
        
        const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();
        await allowanceToken(sender, tokenEth, ethEarningPoolContractAddr);

        const linkEarningPoolContractAddr = await linkEarningPoolContract.getAddress();
        await allowanceToken(sender, tokenLink, linkEarningPoolContractAddr);
    }

    beforeEach(async () => {
        [deployer, sender, invoker] = await ethers.getSigners();

        const isSilent = true;
        const mockErc20ContractName = 'MockERC20';
        token = await deployContractWithDeployer(deployer, mockErc20ContractName, ['USDA', 'USDA'], isSilent);
        tokenEth = await deployContractWithDeployer(deployer, mockErc20ContractName, ['ETH', 'ETH'], isSilent);
        tokenLink = await deployContractWithDeployer(deployer, mockErc20ContractName, ['LINK', 'LINK'], isSilent);

        swapRouterContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);

        const tokenAddr = await token.getAddress();
        const tokenEthAddr = await tokenEth.getAddress();
        const tokenLinkAddr = await tokenLink.getAddress();
        const uniswapRouterAddr = await swapRouterContract.getAddress();

        APoolContract = await deployContractWithDeployer(deployer, 'MockAavePool', [], isSilent);
        const pool = MockAavePool__factory.connect(await APoolContract.getAddress(), ethers.provider);

        ATokenContract = await deployContractWithProxyDeployer(deployer, 'MockAToken', ['AAVE ERC20', 'aERC20'], isSilent);
        const AToken = MockAToken__factory.connect(await ATokenContract.getAddress(), ethers.provider);

        const ATokenAddr = await AToken.getAddress();
        const APoolAddr = await APoolContract.getAddress();

        const poolConnect = pool.connect(deployer);
        await poolConnect.addAToken(tokenAddr, ATokenAddr);
        await poolConnect.addAToken(tokenEthAddr, ATokenAddr);
        await poolConnect.addAToken(tokenLinkAddr, ATokenAddr);

        ethEarningPoolContract = await deployContractWithDeployer(deployer, 'AaveEarningPool', [APoolAddr, ATokenAddr, tokenEthAddr], isSilent);
        const ethEarningPoolContractAddr = await ethEarningPoolContract.getAddress();

        linkEarningPoolContract = await deployContractWithDeployer(deployer, 'AaveEarningPool', [APoolAddr, ATokenAddr, tokenLinkAddr], isSilent);
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
                            id: 20,
                            name: 'sLINK',
                            token: await tokenLink.getAddress(),
                            earningContract: linkEarningPoolContractAddr,
                        }
                    }
                ]
            }
        ]

        /*
            uint256 _maxDeposit,
            uint256 _maxPerUserDeposit,
            uint256 _minDepositAmount,
            ISwapRouter _swapRouter,
            Combo[] calldata _combos
        */
        toTestContract = await deployContractWithDeployer(
            deployer,
            'Earning',
            [],
            isSilent,
        );

        await toTestContract.initialize(tokenAddr, STAKING_FEE, uniswapRouterAddr, MAX_DEPOSIT, MAX_PER_USER_DEPOSIT, MIN_DEPOSIT_AMOUNT, DEFAULT_COMBOS);
        await ethEarningPoolContract.initialize(await toTestContract.getAddress());
        await linkEarningPoolContract.initialize(await toTestContract.getAddress());
    });

    describe('Deposited', () => {
        it('deposit but not enough', async () => {
            const tx = toTestContract.connect(sender).deposit(0, MIN_DEPOSIT_AMOUNT - 1n);
            await expect(tx).to.be.revertedWith('EARN-6');
        });

        it('deposit with 1000 and 2000', async () => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const uniswapRouterAddr = await swapRouterContract.getAddress();

            expect(await tokenEth.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenLink.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT);

            const connect = toTestContract.connect(sender);

            let amount = 1000;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));
            expect(await token.balanceOf(testContractAddr)).to.eq(amount);
            expect(await tokenEth.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT - BigInt(300 - calcFee(300)));
            expect(await tokenLink.balanceOf(uniswapRouterAddr)).to.eq(TEST_AMOUNT - BigInt(700 - calcFee(700)));
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

            expect(userDetail[3].earningId).to.eq(20);
            expect(userDetail[3].amount).to.eq(800 - calcFee(800));
        });
    });

    describe('AverageAPY', () => {
        it('averageAPY work', async() => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const connect = toTestContract.connect(sender);

            const amount = 500;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));

            await advanceBlocks(100);
            expect(await connect.averageAPY(0)).to.eq(5000);
        });
    })

    describe('Redeem', () => {
        it('redeem work', async() => {
            await transferTokens();

            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();

            const connect = toTestContract.connect(sender);

            const SUPPLY_AMOUNT = TEST_AMOUNT;
            await allowanceToken(deployer, token, testContractAddr, false);
            await expect(toTestContract.connect(deployer).supplyReward(SUPPLY_AMOUNT)).to.emit(toTestContract, 'RewardPumped');

            const amount = 1000;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            await advanceBlocks(10);
            const ethAmount = BigInt(300 - calcFee(300));
            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, ethAmount, 0);
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT + ethAmount);

            let userDetail = await connect.listUserEarnDetails(await sender.getAddress());
            expect(userDetail.length).to.eq(1);

            const linkAmount = BigInt(700 - calcFee(700));
            expect(userDetail[0].earningId).to.eq(1);
            expect(userDetail[0].amount).to.eq(linkAmount);

            await expect(connect.redeem(1)).to.rejectedWith('EARN-4');

            await advanceBlocks(100000);
            await expect(connect.redeem(0)).to.emit(toTestContract, 'Redeemed').withArgs(senderAddr, 0, linkAmount, 0);
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));
            expect(await tokenLink.balanceOf(senderAddr)).to.eq(TEST_AMOUNT + linkAmount);

            userDetail = await connect.listUserEarnDetails(await sender.getAddress());
            expect(userDetail.length).to.eq(0);

            await expect(connect.redeem(0)).to.rejectedWith('EARN-9');
        });
    })
});