// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./CloneFactory.sol";
import "./interfaces/IStakingTokenPool.sol";

contract StakingTokenPool is IStakingTokenPool, AccessControlUpgradeable, UUPSUpgradeable, CloneFactory {
    // Who can invoke the pool method in this contract
    bytes32 public constant POOL_ROLE = keccak256("POOL");
    // Who can invoke the submit method in this contract
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER");

    address public masterStaking;

    function initialize(
        address _invoker,
        address[] calldata _updaters,
        address _masterStaking
    ) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(POOL_ROLE, _invoker);
        for (uint256 i = 0; i < _updaters.length; i++) {
            _setupRole(UPDATER_ROLE, _updaters[i]);
        }

        masterStaking = _masterStaking;
        __AccessControl_init_unchained();
    }
    
    function apy() external override {

    }

    function deposit(uint256 _amount) external override onlyRole(UPDATER_ROLE) {

    }

    function redeem(uint256 _amount) external override onlyRole(UPDATER_ROLE) {

    }

    function reward(uint256 _depositBlock) external override onlyRole(UPDATER_ROLE) {

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