// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEarningSwapRouter {
    /// Events
    event ExecutedV3SwapExactInput(address who, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut, uint24 fee);
    event UpdatedSwapRouter(address who, address swapRouter);
    event UpdatedPermit2(address who, address swapRouter);

    /// Methods
    function initialize(address _swapRouter, address _permit2) external;
    function exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) external returns (uint256 amountOut);
}