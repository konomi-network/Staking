// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/uniswap/IAllowanceTransfer.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract MockPermit2 is IAllowanceTransfer {
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48
    ) external override {
        IERC20(token).approve(spender, amount);
        IERC20(token).transferFrom(msg.sender, spender, amount);

        console.log("After MockPermit2 approve token:", token, IERC20(token).balanceOf(address(spender)));
    }
}