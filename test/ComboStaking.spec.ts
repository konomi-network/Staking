import {
    expect
} from 'chai';
import {
    Contract,
    Signer
} from 'ethers';
import {
    ethers
} from 'hardhat';
import {
    deployContractWithDeployer
} from './utils';

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

describe("ComboStaking", function () {
    let token: Contract;
    let tokenEth: Contract;
    let tokenLink: Contract;

    let stakingTokenPoolContract: Contract;
    let swapRouterContract: Contract;

    let stakingContract: Contract;
    let stakingAaveContract: Contract;

    let toTestContract: Contract;

    let deployer: Signer;
    let sender: Signer;
    let user1: Signer;

    beforeEach(async () => {
        [deployer, sender, user1] = await ethers.getSigners();

        const isSilent = true;

        const mockErc20ContractName = 'MockERC20';
        token = await deployContractWithDeployer(deployer, mockErc20ContractName, ['USDA', 'USDA'], isSilent);
        tokenEth = await deployContractWithDeployer(deployer, mockErc20ContractName, ['ETH', 'ETH'], isSilent);
        tokenLink = await deployContractWithDeployer(deployer, mockErc20ContractName, ['LINK', 'LINK'], isSilent);

        stakingTokenPoolContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);
        swapRouterContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);

        stakingContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);
        stakingAaveContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);

        const DEFAULT_COMBOS = [{
                creditRating: 0,
                entries: [{
                        weight: 30,
                        staking: {
                            id: 0,
                            name: 'ETH',
                            token: await tokenEth.getAddress(),
                            stakingContract: await stakingContract.getAddress(),
                        }
                    },
                    {
                        weight: 70,
                        staking: {
                            id: 1,
                            name: 'LINK',
                            token: await tokenLink.getAddress(),
                            stakingContract: await stakingContract.getAddress(),
                        }
                    }
                ]
            },
            {
                creditRating: 1,
                entries: [{
                        weight: 60,
                        staking: {
                            id: 10,
                            name: 'ETH',
                            token: await tokenEth.getAddress(),
                            stakingContract: await stakingAaveContract.getAddress(),
                        }
                    },
                    {
                        weight: 40,
                        staking: {
                            id: 20,
                            name: 'LINK',
                            token: await tokenLink.getAddress(),
                            stakingContract: await stakingAaveContract.getAddress(),
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
            'ComboStaking',
            [],
            isSilent,
        );

        const tokenAddr = await token.getAddress();
        const stakingTokenPoolAddr = await stakingTokenPoolContract.getAddress();
        const uniswapRouterAddr = await swapRouterContract.getAddress();
        await toTestContract.initialize(tokenAddr, STAKING_FEE, stakingTokenPoolAddr, uniswapRouterAddr, MAX_DEPOSIT, MAX_PER_USER_DEPOSIT, MIN_DEPOSIT_AMOUNT, DEFAULT_COMBOS);
    });

    describe('Deposited', () => {
        it('deposit but not enough', async () => {
            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const tokenAddr = await token.getAddress();

            await expect(await token.connect(deployer).transfer(senderAddr, TEST_AMOUNT)).to.emit(token, 'Transfer');
            await expect(token.connect(sender).increaseAllowance(testContractAddr, TEST_AMOUNT)).to.emit(
                token,
                'Approval',
            );

            const tx = toTestContract.connect(sender).deposit(0, MIN_DEPOSIT_AMOUNT - 1n);
            await expect(tx).to.be.revertedWith('STAKE-6');
        });

        it('deposit with 1000 and 2000', async () => {
            const senderAddr = await sender.getAddress();
            const testContractAddr = await toTestContract.getAddress();
            const tokenAddr = await token.getAddress();

            await expect(await token.connect(deployer).transfer(senderAddr, TEST_AMOUNT)).to.emit(token, 'Transfer');
            await expect(token.connect(sender).increaseAllowance(testContractAddr, TEST_AMOUNT)).to.emit(
                token,
                'Approval',
            );
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT);
            const connect = toTestContract.connect(sender);
            await expect(connect.deposit(0, 1000)).to.emit(toTestContract, 'Deposited');
            await expect(connect.deposit(1, 2000)).to.emit(toTestContract, 'Deposited');

            const userDetail = await connect.listUserStakeDetails(await sender.getAddress());
            expect(userDetail.length).to.eq(4);

            expect(userDetail[0].stakingId).to.eq(0);
            expect(userDetail[0].amount).to.eq(300 - calcFee(300));

            expect(userDetail[1].stakingId).to.eq(1);
            expect(userDetail[1].amount).to.eq(700 - calcFee(700));

            expect(userDetail[2].stakingId).to.eq(10);
            expect(userDetail[2].amount).to.eq(1200 - calcFee(1200));

            expect(userDetail[3].stakingId).to.eq(20);
            expect(userDetail[3].amount).to.eq(800 - calcFee(800));
        });
    });
});