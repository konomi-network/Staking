// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./CloneFactory.sol";
import "./interfaces/IStakingTokenPool.sol";

contract StakingTokenPool is IStakingTokenPool, AccessControlUpgradeable, UUPSUpgradeable, CloneFactory, ReentrancyGuard {
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

    function initialize(
        address _invoker,
        address[] calldata _updaters,
        address _stakingToken
    ) public initializer {
        defaultAdmin = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(POOL_ROLE, _invoker);
        for (uint256 i = 0; i < _updaters.length; i++) {
            _setupRole(UPDATER_ROLE, _updaters[i]);
        }

        stakingToken = IERC20(_stakingToken);

        totalSupply = 0;

        __AccessControl_init_unchained();
    }
    
    function apy() external override returns (uint256) {
        return 1;
    }

    function deposit(uint256 _amount) external override nonReentrant onlyRole(UPDATER_ROLE) {
        require(_amount > 0, "STAKE-10");

        totalSupply += _amount;
        userTotalStake[msg.sender] += _amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposited(msg.sender, _amount);
    }

    function redeem(uint256 _amount) external override nonReentrant onlyRole(UPDATER_ROLE) {
        require(_amount > 0, "STAKE-10");

        totalSupply -= _amount;
        userTotalStake[msg.sender] -= _amount;
        stakingToken.safeTransfer(msg.sender, _amount);

        emit Redeemed(msg.sender, _amount);
    }

    function reward(uint256 _depositBlock) external override nonReentrant onlyRole(UPDATER_ROLE) {

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