// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

import "./MockAToken.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract MockAavePool {
    mapping(address => address) public assetToAToken;

    function addAToken(address asset, address atoken) public {
        assetToAToken[asset] = atoken;
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) public virtual {
        referralCode;
        console.log(">>> MockAavePool supply:", onBehalfOf, amount);

        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        MockAToken atoken = MockAToken(assetToAToken[asset]);
        atoken.mint(onBehalfOf, amount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) public virtual returns (uint256) {
        MockAToken atoken = MockAToken(assetToAToken[asset]);
        atoken.burn(msg.sender, amount);

        IERC20(asset).transfer(to, amount);
        return amount;
    }

    function getReserveData(address asset) external pure returns (DataTypes.ReserveData memory data) {
        data.aTokenAddress = asset;
        data.currentLiquidityRate = 16393529817768722931310203;
        data.lastUpdateTimestamp = 1;
    }
}