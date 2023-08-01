// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakingTokenPool {
    function apy() external;
    function deposit(uint256 _amount) external;
    function redeem(uint256 _amount) external;
    function reward(uint256 _depositBlock) external;
}