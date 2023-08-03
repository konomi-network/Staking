// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IEarningPool.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

abstract contract EarningPool is IEarningPool, AccessControlUpgradeable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // The underlying earning token
    IERC20 public earningToken;

    // Who can invoke the pool method in this contract
    bytes32 public constant POOL_ROLE = keccak256("POOL");

    // The total amount of supply for this contract
    uint256 public totalSupply;

    constructor(address _earningToken) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        earningToken = IERC20(_earningToken);
    }

    function initialize(address _invoker) public initializer {
        _setupRole(POOL_ROLE, _invoker);

        __AccessControl_init_unchained();
    }

    function deposit(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        require(amount > 0, "EARN-10");

        totalSupply += amount;

        _depositStakingToken(onBehalfOf, amount);

        emit Deposited(onBehalfOf, amount);
    }

    function redeem(address onBehalfOf, uint256 amount) external override nonReentrant onlyRole(POOL_ROLE) {
        require(amount > 0, "EARN-10");
        require(totalSupply >= amount, "EARN-13");

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