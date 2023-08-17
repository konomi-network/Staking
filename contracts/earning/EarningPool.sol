// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IEarningPool.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../libraries/utils/MathUtils.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

abstract contract EarningPool is IEarningPool, ReentrancyGuard, AccessControlUpgradeable, UUPSUpgradeable {
    // The underlying earning token
    IERC20 public earningToken;

    // Who can invoke the pool method in this contract
    bytes32 public constant POOL_ROLE = keccak256("POOL");

    // The mapping that tracks the total amount earned of an address
    mapping(address => uint256) public userTotalEarn;

    /// @dev Ignoring leap years
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    // The maximum deposit amount a user can earn
    uint256 public maxPerUserDeposit;

    // The total amount of supply for this contract
    uint256 public totalSupply;

    // Maximum percentage factor (100.00%)
    uint16 internal constant PERCENTAGE_FACTOR = 1e4;

    // The maximum interest rate, i.e. 500 represents 5%
    uint16 public maxInterestRate;
    
    function __EarningPool_init(
        address _earningToken,
        uint256 _maxPerUserDeposit,
        uint16 _maxInterestRate) internal onlyInitializing {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        earningToken = IERC20(_earningToken);

        maxPerUserDeposit = _maxPerUserDeposit;

        maxInterestRate = _maxInterestRate;

        __ReentrancyGuard_init();
        __AccessControl_init_unchained();
    }

    function setInvoker(address _invoker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setupRole(POOL_ROLE, _invoker);
    }

    function setMaxInterestRate(uint16 _maxInterestRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxInterestRate = _maxInterestRate;

        emit UpdatedMaxInterestRate(msg.sender, _maxInterestRate);
    }

    function setMaxPerUserDeposit(uint256 _maxPerUserDeposit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPerUserDeposit = _maxPerUserDeposit;

        emit UpdatedMaxPerUserDeposit(msg.sender, _maxPerUserDeposit);
    }

    function deposit(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        if (amount <= 0) {
            revert DepositAmountMustBeGreaterThanZero();
        }

        // Update user total earn amount
        uint256 userEarnAmount = userTotalEarn[onBehalfOf] + amount;
        if (userEarnAmount > maxPerUserDeposit) {
            revert DepositReachedMaximumAmountPerUser();
        }

        userTotalEarn[onBehalfOf] = userEarnAmount;

        totalSupply += amount;

        _depositStakingToken(onBehalfOf, amount);

        emit Deposited(onBehalfOf, address(earningToken), amount);
    }

    function redeem(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        if (amount <= 0) {
            revert RedeemAmountMustBeGreaterThanZero();
        }

        // Only processing memory, as third-party contracts will not be updated to memory
        uint256 userEarn = userTotalEarn[onBehalfOf];

        // TODO: need check rewardAmound??
        if (userEarn <= amount) {
            delete userTotalEarn[onBehalfOf];
            totalSupply -= userEarn;
        } else {
            userTotalEarn[onBehalfOf] -= amount;
            totalSupply -= amount;
        }

        _redeemStakingToken(onBehalfOf, amount);

        emit Redeemed(onBehalfOf, address(earningToken), amount);
    }

    function apy() external view returns (uint256 supplyRatePerYear) {
        supplyRatePerYear = _fixedApy();
    }

    function reward(address onBehalfOf, uint256 depositBlock) external override view returns (uint256) {
        return _calculateReward(userTotalEarn[onBehalfOf], currentTime(), depositBlock);
    }

    function _calculateReward(uint256 amount, uint256 currentTimestamp, uint256 depositBlock) internal view returns (uint256 rewardAmount) {
        rewardAmount = amount * _fixedApy() * (currentTimestamp - depositBlock);
        unchecked {
            rewardAmount = rewardAmount / SECONDS_PER_YEAR / PERCENTAGE_FACTOR;
        }

        // console.log(">>> _calculateReward:", rewardAmount, _calculateApy(), _fixedApy());
    }

    function _fixedApy() internal view returns (uint256 supplyRatePerYear) {
        supplyRatePerYear = MathUtils.min(_calculateApy(), maxInterestRate);
    }

    function _calculateApy() internal view virtual returns (uint256 supplyRatePerYear);

    function _depositStakingToken(address onBehalfOf, uint256 amount) internal virtual;

    function _redeemStakingToken(address onBehalfOf, uint256 amount) internal virtual;

    /**
     * @dev get current time
     */
    function currentTime() public view returns (uint256) {
        return block.timestamp;
    }

    /**
     *  Used to control authorization of upgrade methods
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        view
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        newImplementation; // silence the warning
    }
}