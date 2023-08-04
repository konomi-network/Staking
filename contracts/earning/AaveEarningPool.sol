// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IAToken } from "@aave/core-v3/contracts/interfaces/IAToken.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import { MathUtils } from "@aave/core-v3/contracts/protocol/libraries/math/MathUtils.sol";
import { WadRayMath } from "@aave/core-v3/contracts/protocol/libraries/math/WadRayMath.sol";

import "./EarningPool.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract AaveEarningPool is EarningPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IPool public aavePool;
    IAToken public aToken;

    // WadRayMath.RAY returns 1e27, which is rounded to tens of thousands, i.e. 500 represents 5%
    uint256 internal constant RESERVED_RATE = 10**23;

    constructor(address _aavePool, address _aToken, address _earningToken, uint256 _maxPerUserDeposit) 
        EarningPool(_earningToken, _maxPerUserDeposit) {
        aavePool = IPool(_aavePool);
        aToken = IAToken(_aToken);
        aToken.approve(_aavePool, type(uint256).max);
    }

    function apy() external override view returns (uint256) {
        return _apy(currentTime());
    }

    function reward(address onBehalfOf, uint256 depositBlock) external override view returns (uint256) {
        uint256 currentTimestamp = currentTime();
        if (currentTimestamp <= depositBlock) {
            return 0;
        }

        uint256 savedAmount = userTotalEarn[onBehalfOf];
        return _calculateReward(savedAmount, currentTimestamp, depositBlock);
    }

    function _calculateReward(uint256 amount, uint256 currentTimestamp, uint256 depositBlock) internal view returns (uint256 rewardAmount) {
        rewardAmount = amount * _apy(currentTimestamp) * (currentTimestamp - depositBlock) / SECONDS_PER_YEAR / RATE_PERCENT;

        // console.log(">>> _calculateReward: ", rewardAmount, amount);
    }

    function _apy(uint256 currentTimestamp) internal view returns (uint256) {
        DataTypes.ReserveData memory data = aavePool.getReserveData(address(earningToken));
        // MathUtils.calculateCompoundedInterest did not handle currentTimestamp less than lastUpdateTimestamp.
        if (currentTimestamp <= data.lastUpdateTimestamp) {
            return WadRayMath.RAY / RESERVED_RATE;
        }
        return MathUtils.calculateCompoundedInterest(data.currentLiquidityRate, data.lastUpdateTimestamp, currentTimestamp) / RESERVED_RATE;
    }

    function _depositStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
        earningToken.safeTransferFrom(onBehalfOf, address(this), amount);

        // Auto deposit user earning to AAVE
        earningToken.approve(address(aavePool), amount);
        aavePool.supply(address(earningToken), amount, address(this), 0);
    }

    function _redeemStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
        // Withdraw from AAVE first
        aavePool.withdraw(address(earningToken), amount, address(this));

        earningToken.safeTransfer(onBehalfOf, amount);
    }
}