// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IStakingPool.sol";

abstract contract StakingPool is IStakingPool, AccessControlUpgradeable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // The underlying staking token
    IERC20 public stakingToken;

    // Who can invoke the pool method in this contract
    bytes32 public constant POOL_ROLE = keccak256("POOL");

    // The total amount of supply for this contract
    uint256 public totalSupply;

    constructor(address _stakingToken) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        stakingToken = IERC20(_stakingToken);
    }

    function initialize(address _invoker) public initializer {
        _setupRole(POOL_ROLE, _invoker);

        __AccessControl_init_unchained();
    }

    function deposit(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        require(amount > 0, "STAKE-10");

        totalSupply += amount;

        _depositStakingToken(onBehalfOf, amount);

        emit Deposited(onBehalfOf, amount);
    }

    function redeem(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        require(amount > 0, "STAKE-10");

        totalSupply -= amount;

        _redeemStakingToken(onBehalfOf, amount);

        emit Redeemed(onBehalfOf, amount);
    }

    function _depositStakingToken(address onBehalfOf, uint256 amount) internal virtual;

    function _redeemStakingToken(address onBehalfOf, uint256 amount) internal virtual;

    /**
     * @dev get current time
     */
    function currentTime() public view returns (uint256) {
        return block.number;
    }
}