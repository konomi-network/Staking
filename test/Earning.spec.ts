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

    let AEarningPoolContract: Contract;
    let APoolContract: Contract;
    let ATokenContract: Contract;

    let swapRouterContract: Contract;

    let toTestContract: Contract;

    let deployer: Signer;
    let sender: Signer;
    let invoker: Signer;

    const transferToken = async(token: Contract, contractAddr: string) => {
        const senderAddr = await sender.getAddress();
    
        await expect(await token.connect(deployer).transfer(senderAddr, TEST_AMOUNT)).to.emit(token, 'Transfer');
        await expect(token.connect(sender).increaseAllowance(contractAddr, TEST_AMOUNT)).to.emit(
            token,
            'Approval',
        );
        expect(await token.allowance(senderAddr, contractAddr)).to.eq(TEST_AMOUNT);
        expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);
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

        AEarningPoolContract = await deployContractWithDeployer(deployer, 'AaveEarningPool', [APoolAddr, ATokenAddr, tokenEthAddr], isSilent);

        const DEFAULT_COMBOS = [{
                creditRating: 0,
                entries: [{
                        weight: 30,
                        earning: {
                            id: 0,
                            name: 'ETH',
                            token: await tokenEth.getAddress(),
                            earningContract: await AEarningPoolContract.getAddress(),
                        }
                    },
                    {
                        weight: 70,
                        earning: {
                            id: 1,
                            name: 'LINK',
                            token: await tokenLink.getAddress(),
                            earningContract: await AEarningPoolContract.getAddress(),
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
                            earningContract: await AEarningPoolContract.getAddress(),
                        }
                    },
                    {
                        weight: 40,
                        earning: {
                            id: 20,
                            name: 'sLINK',
                            token: await tokenLink.getAddress(),
                            earningContract: await AEarningPoolContract.getAddress(),
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
        await AEarningPoolContract.initialize(await toTestContract.getAddress());
    });

    describe('Deposited', () => {
        it('deposit but not enough', async () => {
            const tx = toTestContract.connect(sender).deposit(0, MIN_DEPOSIT_AMOUNT - 1n);
            await expect(tx).to.be.revertedWith('EARN-6');
        });

        it('deposit with 1000 and 2000', async () => {
            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();

            await transferToken(token, testContractAddr);

            const AEarningPoolContractAddr = await AEarningPoolContract.getAddress();
            await transferToken(tokenEth, AEarningPoolContractAddr);

            const connect = toTestContract.connect(sender);
            await expect(connect.deposit(0, 1000)).to.emit(toTestContract, 'Deposited');
            await expect(connect.deposit(1, 2000)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - 3000n);

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
            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            console.log(">>> sender address:", senderAddr);
        
            await transferToken(token, testContractAddr);
            const AEarningPoolContractAddr = await AEarningPoolContract.getAddress();
            await transferToken(tokenEth, AEarningPoolContractAddr);

            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);

            const connect = toTestContract.connect(sender);

            const amount = 500;
            await expect(connect.deposit(0, amount)).to.emit(toTestContract, 'Deposited');
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount));
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amount - calcFee(amount)));

            await advanceBlocks(100);
            expect(await connect.averageAPY(0)).to.eq(5000);
        });
    })
});