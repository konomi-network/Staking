// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/uniswap/IUniversalRouter.sol";
import "./BytesLib.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract MockSwapRouter is IUniversalRouter {
    using BytesLib for bytes;

    uint24 public constant MOCK_AMOUT_IN = 1;
    uint24 public constant MOCK_AMOUT_OUT = 1;

    function execute(bytes calldata, bytes[] calldata inputs, uint256) external payable {
        address recipient;
        uint256 amountIn;
        uint256 amountOutMin;
        bool payerIsUser;

        bytes calldata input = inputs[1];
        assembly {
            recipient := calldataload(input.offset)
            amountIn := calldataload(add(input.offset, 0x20))
            amountOutMin := calldataload(add(input.offset, 0x40))
            // 0x60 offset is the path, decoded below
            payerIsUser := calldataload(add(input.offset, 0x80))
        }
        bytes calldata path = input.toBytes(3);

        (,,address tokenOut) = path.toPool();

        console.log("MockSwapRouter execute:", tokenOut, recipient, amountIn);

        IERC20(tokenOut).approve(recipient, amountIn);
        IERC20(tokenOut).transfer(recipient, amountIn);
    }
}