// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IStakingPool.sol";

abstract contract StakingPool is IStakingPool, Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // The underlying staking token
    IERC20 public stakingToken;

    // Who can invoke the pool method in this contract
    bytes32 public constant POOL_ROLE = keccak256("POOL");
    // Who can invoke the submit method in this contract
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER");

    // The mapping that tracks the total amount staked of an address
    mapping(address => uint256) public userTotalStake;

    address public defaultAdmin;
    address public masterStaking;

    // The total amount of supply for this contract
    uint256 public totalSupply;

    constructor(address _stakingToken) Ownable() {
        stakingToken = IERC20(_stakingToken);
    }

    function deposit(uint256 amount) external override nonReentrant {
        require(amount > 0, "STAKE-10");

        totalSupply += amount;
        userTotalStake[msg.sender] += amount;
        _depositStakingToken(amount);

        emit Deposited(msg.sender, amount);
    }

    function _depositStakingToken(uint256 amount) internal virtual {
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function redeem(uint256 amount) external override nonReentrant {
        require(amount > 0, "STAKE-10");

        totalSupply -= amount;
        userTotalStake[msg.sender] -= amount;
        _redeemStakingToken(amount);

        emit Redeemed(msg.sender, amount);
    }

    function _redeemStakingToken(uint256 amount) internal virtual {
        stakingToken.safeTransfer(msg.sender, amount);
    }
}