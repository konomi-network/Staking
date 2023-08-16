// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IComet {
    function supply(address asset, uint amount) external;
    function withdraw(address asset, uint amount) external;

    function getUtilization() external view returns (uint);
    function getSupplyRate(uint utilization) external view returns (uint64);
}
