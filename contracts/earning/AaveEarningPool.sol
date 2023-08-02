// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IAToken } from "@aave/core-v3/contracts/interfaces/IAToken.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import { MathUtils } from "@aave/core-v3/contracts/protocol/libraries/math/MathUtils.sol";

import "./EarningPool.sol";

contract AaveEarningPool is EarningPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IPool public aavePool;
    IAToken public aToken;

    constructor(address _aavePool, address _aToken, address _earningToken) EarningPool(_earningToken) {
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
        DataTypes.ReserveData memory data = aavePool.getReserveData(address(earningToken));
        return MathUtils.calculateCompoundedInterest(data.currentLiquidityRate, data.lastUpdateTimestamp, currentTimestamp) / 1e23;
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