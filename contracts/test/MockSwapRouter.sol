// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract MockSwapRouter is ISwapRouter {
    uint24 public constant MOCK_AMOUT_IN = 1;
    uint24 public constant MOCK_AMOUT_OUT = 1;

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable override returns (uint256 amountOut) {
        amountOut = MOCK_AMOUT_OUT * params.amountIn;
    }

    function exactInput(
        ExactInputParams calldata params
    ) external payable override returns (uint256 amountOut) {
        amountOut = MOCK_AMOUT_OUT * params.amountIn;
    }

    function exactOutputSingle(
        ExactOutputSingleParams calldata params
    ) external payable override returns (uint256 amountIn) {
        amountIn = MOCK_AMOUT_IN * params.amountOut;
    }

    function exactOutput(
        ExactOutputParams calldata params
    ) external payable override returns (uint256 amountIn) {
        amountIn = MOCK_AMOUT_IN * params.amountOut;
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        amount0Delta;
        amount1Delta;
        data;
    }
}