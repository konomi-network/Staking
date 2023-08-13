// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

interface IEarningSwapRouter {
    /// Events
    event ExcutedV3SwapExactInput(address who, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut, uint24 fee);

    /// Methods
    function initialize(address _swapRouter, address _permit2) external;
    function exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) external returns (uint256 amountOut);
}