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
import { EarningSwapRouter__factory } from '../typechain-types/factories/contracts';


// platform fee, i.e. 1000 represents 1%
const PLATFORM_FEE = 1000;
const TEST_AMOUNT = expandTo18Decimals(10000);

function expandTo18Decimals(n: number): bigint {
    return BigInt(n) * (10n ** 18n);
}

describe("EarningSwapRouter", function () {
    let token: Contract;
    let tokenEth: Contract;

    let earningSwapRouterContract: Contract;
    let universalRouterContract: Contract;
    let permit2Contract: Contract;

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
        
        const universalRouterAddr = await universalRouterContract.getAddress();
        await transferToken(tokenEth, universalRouterAddr);

        const earningSwapRouterContractAddr = await earningSwapRouterContract.getAddress();
        await allowanceToken(sender, token, earningSwapRouterContractAddr);
    }

    beforeEach(async () => {
        [deployer, sender] = await ethers.getSigners();

        const isSilent = true;
        const mockErc20ContractName = 'MockERC20';
        token = await deployContractWithDeployer(deployer, mockErc20ContractName, ['USDA', 'USDA'], isSilent);
        tokenEth = await deployContractWithDeployer(deployer, mockErc20ContractName, ['ETH', 'ETH'], isSilent);

        universalRouterContract = await deployContractWithDeployer(deployer, 'MockSwapRouter', [], isSilent);
        permit2Contract = await deployContractWithDeployer(deployer, 'MockPermit2', [], isSilent);

        const universalRouterAddr = await universalRouterContract.getAddress();
        const permit2Addr = await permit2Contract.getAddress();

        earningSwapRouterContract = await deployContractWithProxyDeployer(deployer, 'EarningSwapRouter', [
            universalRouterAddr,
            permit2Addr
        ], isSilent);

        await earningSwapRouterContract.setInvoker(await sender.getAddress());
        await earningSwapRouterContract.setSwapRouter(await universalRouterContract.getAddress());
        await earningSwapRouterContract.setPermit2(await permit2Contract.getAddress());
    });

    describe('SetEnv', () => {
        it('setSwapRouter work', async () => {
            const testContractAddr = await earningSwapRouterContract.getAddress();
            const universalRouterAddr = await universalRouterContract.getAddress();

            const contract = EarningSwapRouter__factory.connect(testContractAddr, deployer);

            await expect(contract.setSwapRouter(universalRouterAddr)).to.emit(contract, 'UpdatedSwapRouter');
        });

        it('setSwapRouter missing role', async () => {
            const testContractAddr = await earningSwapRouterContract.getAddress();
            const universalRouterAddr = await universalRouterContract.getAddress();

            const contract = EarningSwapRouter__factory.connect(testContractAddr, sender);

            await expect(contract.setSwapRouter(universalRouterAddr)).to.rejectedWith(/AccessControl: account .* is missing role .*/);
        });

        it('setPermit2 work', async () => {
            const testContractAddr = await earningSwapRouterContract.getAddress();

            const contract = EarningSwapRouter__factory.connect(testContractAddr, deployer);

            await expect(contract.setPermit2('0x000000000022D473030F116dDEE9F6B43aC78BA3')).to.emit(contract, 'UpdatedPermit2');
        });

        it('setPermit2 missing role', async () => {
            const testContractAddr = await earningSwapRouterContract.getAddress();

            const contract = EarningSwapRouter__factory.connect(testContractAddr, sender);

            await expect(contract.setPermit2('0x000000000022D473030F116dDEE9F6B43aC78BA3')).to.rejectedWith(/AccessControl: account .* is missing role .*/);
        });
    });

    describe('ExactInputSingle', () => {
        it('exactInputSingle ok', async () => {
            await transferTokens();

            const tokenAddr = await token.getAddress();
            const tokenEthAddr = await tokenEth.getAddress();

            const senderAddr = await sender.getAddress();
            const earningSwapRouterAddr = await earningSwapRouterContract.getAddress();
            const universalRouterAddr = await universalRouterContract.getAddress();

            expect(await tokenEth.balanceOf(universalRouterAddr)).to.eq(TEST_AMOUNT);

            const contract = EarningSwapRouter__factory.connect(earningSwapRouterAddr, sender);

            const amountIn = 1000n;
            await expect(contract.exactInputSingle(senderAddr, tokenAddr, amountIn, tokenEthAddr, PLATFORM_FEE)).to.emit(earningSwapRouterContract, 'ExecutedV3SwapExactInput');
            expect(await token.balanceOf(earningSwapRouterAddr)).to.eq(0);
            expect(await token.balanceOf(senderAddr)).to.eq(TEST_AMOUNT - BigInt(amountIn));
            expect(await tokenEth.balanceOf(senderAddr)).to.eq(TEST_AMOUNT + BigInt(amountIn));
        });
    });
});