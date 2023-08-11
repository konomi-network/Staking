// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEarningSwapRouter {
    /// Events
    event ExactInputSingled(address who, address tokenIn, uint256 amountIn, address tokenOut, uint24 fee);

    /// Methods
    function initialize(address _swapRouter) external;

    function exactInputSingle(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) external returns (uint256 amountOut);

    function exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) external returns (uint256 amountOut);
}