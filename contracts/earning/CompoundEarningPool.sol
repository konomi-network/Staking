// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./EarningPool.sol";

import "./interfaces/ICompound.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract CompoundEarningPool is EarningPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    CErc20 public cToken;

    uint256 internal constant BASE_MANTISSA = 10**18;
    uint256 internal constant BLOCKS_PER_DAY = 5760;
    uint256 internal constant DAYS_PER_YEAR = 365;
    uint256 internal constant RATE_PERCENT = 10**4;
    /// @dev Ignoring leap years
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    constructor(address _cToken, address _earningToken, uint256 _maxPerUserDeposit) 
        EarningPool(_earningToken, _maxPerUserDeposit) {
        // Create a reference to the corresponding cToken contract, like cDAI
        cToken = CErc20(_cToken);
    }

    function apy() external override view returns (uint256) {
        return _apy();
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
        rewardAmount = amount * _apy() * (currentTimestamp - depositBlock) / SECONDS_PER_YEAR / RATE_PERCENT;
    }

    function _apy() internal view returns (uint256) {
        uint256 supplyRatePerBlock = cToken.supplyRatePerBlock();
        uint256 supplyRatePerDay = supplyRatePerBlock / BASE_MANTISSA * BLOCKS_PER_DAY;
        return ((supplyRatePerDay + 1) ** (DAYS_PER_YEAR - 1) - 1) * RATE_PERCENT;
    }

    function _depositStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
        earningToken.safeTransferFrom(onBehalfOf, address(this), amount);

        // Approve transfer on the ERC20 contract
        earningToken.approve(address(cToken), amount);

        // Mint cTokens
        uint errorCode = cToken.mint(amount);
        if (errorCode != NO_ERROR) {
            revert MintComptrollerRejection(errorCode);
        }
    }

    function _redeemStakingToken(address onBehalfOf, uint256 amount) override internal virtual {
        // Redeem cTokens
        uint errorCode = cToken.redeem(amount);
        if (errorCode != NO_ERROR) {
            revert RedeemComptrollerRejection(errorCode);
        }

        earningToken.safeTransfer(onBehalfOf, amount);
    }
}