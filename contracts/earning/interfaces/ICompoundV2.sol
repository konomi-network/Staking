// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface CErc20 {
    function mint(uint) external returns (uint256);
    function redeem(uint) external returns (uint);
    function supplyRatePerBlock() external view returns (uint256);
}
