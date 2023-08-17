// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../earning/interfaces/ICompoundV3.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract MockComet is IComet {
    function supply(address asset, uint amount) external override {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        console.log(">>> MockComet supply:", asset, amount);
    }

    function withdraw(address asset, uint amount) external override {
        IERC20(asset).approve(msg.sender, amount);
        IERC20(asset).transfer(msg.sender, amount);

        console.log(">>> MockComet withdraw:", asset, amount);
    }

    function getUtilization() external pure override returns (uint) {
        return 162829422396984898;
    }

    function getSupplyRate(
        uint utilization
    ) external view override returns (uint64 rate) {
        rate = uint64(1030568239 * utilization / 1e18);

        console.log(">>> MockComet getSupplyRate:", rate, block.number, block.timestamp);
    }
}