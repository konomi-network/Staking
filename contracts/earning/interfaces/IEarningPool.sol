// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEarningPool {
    /// Events
    event Deposited(address who, uint256 amount);
    event Redeemed(address who, uint256 amount);

    /// Methods
    function apy() external view returns (uint256);
    function deposit(address onBehalfOf, uint256 amount) external;
    function redeem(address onBehalfOf, uint256 amount) external;
    function reward(uint256 depositBlock) external returns (uint256);
}