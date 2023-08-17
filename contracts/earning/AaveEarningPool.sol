// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { IAToken } from "@aave/core-v3/contracts/interfaces/IAToken.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import { WadRayMath } from "@aave/core-v3/contracts/protocol/libraries/math/WadRayMath.sol";

import "./EarningPool.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract AaveEarningPool is EarningPool {
    using SafeERC20 for IERC20;

    IPool public aavePool;
    IAToken public aToken;

    // WadRayMath.RAY returns 1e27, which is rounded to tens of thousands, i.e. 500 represents 5%
    uint256 internal constant RESERVED_RATE = WadRayMath.RAY / PERCENTAGE_FACTOR;

    function initialize(
        address _aavePool,
        address _aToken,
        address _earningToken,
        uint256 _maxPerUserDeposit,
        uint16 _maxInterestRate) external initializer {
        __EarningPool_init(_earningToken, _maxPerUserDeposit, _maxInterestRate);

        aavePool = IPool(_aavePool);
        aToken = IAToken(_aToken);
        aToken.approve(_aavePool, type(uint256).max);
    }

    function _calculateApy() override internal view virtual returns (uint256 supplyRatePerYear) {
        DataTypes.ReserveData memory data = aavePool.getReserveData(address(earningToken));
        unchecked {
            supplyRatePerYear = data.currentLiquidityRate / RESERVED_RATE;
        }
        // console.log(">>> AaveEarningPool _apy:", data.currentLiquidityRate, supplyRatePerYear);
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