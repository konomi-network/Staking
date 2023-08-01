// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakingTokenPool {
    /// Events
    event Deposited(address who, uint256 amount);
    event Redeemed(address who, uint256 amount);

    /// Methods
    function apy() external returns (uint256);
    function deposit(uint256 _amount) external;
    function redeem(uint256 _amount) external;
    function reward(uint256 _depositBlock) external;
}