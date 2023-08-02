// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IAToken } from "@aave/core-v3/contracts/interfaces/IAToken.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import { MathUtils } from "@aave/core-v3/contracts/protocol/libraries/math/MathUtils.sol";

import "./StakingPool.sol";

contract AaveStakingPool is StakingPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IPool public aavePool;
    IAToken public aToken;

    constructor(
        address _aavePool,
        address _aToken,
        address _stakingToken
    ) StakingPool(_stakingToken) {
        aavePool = IPool(_aavePool);
        aToken = IAToken(_aToken);
        aToken.approve(_aavePool, type(uint256).max);
    }

    function apy() external override view returns (uint256) {
        return _apy(currentTime());
    }

    function reward(uint256 depositBlock) external override view returns (uint256) {
        return _apy(depositBlock);
    }

    function _apy(uint256 currentTimestamp) internal view returns (uint256) {
        DataTypes.ReserveData memory data = aavePool.getReserveData(address(stakingToken));
        return MathUtils.calculateCompoundedInterest(data.currentLiquidityRate, data.lastUpdateTimestamp, currentTimestamp);
    }

    function _depositStakingToken(uint256 amount) override internal virtual {
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Auto deposit user staking to AAVE
        stakingToken.approve(address(aavePool), amount);
        aavePool.supply(address(stakingToken), amount, address(this), 0);
    }

    function _redeemStakingToken(uint256 amount) override internal virtual {
        // Withdraw from AAVE first
        aavePool.withdraw(address(stakingToken), amount, address(this));

        stakingToken.safeTransfer(msg.sender, amount);
    }
}