// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./EarningPool.sol";

import "./interfaces/ICompoundV3.sol";

import "./libraries/WadMath.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract CompoundV3EarningPool is EarningPool {
    using WadMath for uint256;
    using SafeERC20 for IERC20;

    IComet public comet;

    function initialize(
        address _comet,
        address _earningToken,
        uint256 _maxPerUserDeposit,
        uint16 _maxInterestRate) external initializer {
        __EarningPool_init(_earningToken, _maxPerUserDeposit, _maxInterestRate);

        comet = IComet(_comet);
    }

    /**
     * https://docs.compound.finance/interest-rates/
     * 
     * To calculate the Compound III supply APR as a percentage, pass the current utilization to this function, 
     * and divide the result by 10 ^ 18 and multiply by the approximate number of seconds in one year and scale up by 100.
     * 
     * Seconds Per Year = 60 * 60 * 24 * 365
     * Utilization = getUtilization()
     * Supply Rate = getSupplyRate(Utilization)
     * Supply APR = Supply Rate / (10 ^ 18) * Seconds Per Year * 100
     */
    function _calculateApy() override internal view virtual returns (uint256 supplyRatePerYear) {
        uint utilization = comet.getUtilization();
        supplyRatePerYear = comet.getSupplyRate(utilization) * SECONDS_PER_YEAR * PERCENTAGE_FACTOR / WadMath.WAD;
    }

    function _depositStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
        earningToken.safeTransferFrom(onBehalfOf, address(this), amount);

        // Approve transfer on the ERC20 contract
        earningToken.approve(address(comet), amount);

        comet.supply(address(earningToken), amount);
    }

    function _redeemStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
       comet.withdraw(address(earningToken), amount);

        earningToken.safeTransfer(onBehalfOf, amount);
    }
}