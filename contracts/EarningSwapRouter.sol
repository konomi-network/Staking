// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./interfaces/IEarningSwapRouter.sol";

contract EarningSwapRouter is IEarningSwapRouter, AccessControlUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // Who can invoke the pool method in this contract
    bytes32 public constant INVOKER_ROLE = keccak256("INVOKER");

    // The swapRouter of uniswap-v3
    address public swapRouter;

    function initialize(address _swapRouter) external override initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        swapRouter = _swapRouter;
    }

    function setInvoker(address _invoker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setupRole(INVOKER_ROLE, _invoker);
    }

    function exactInputSingle(address tokenIn, uint256 amountIn, address tokenOut, uint24 fee) external override returns (uint256) {
        return _exactInputSingle(msg.sender, tokenIn, amountIn, tokenOut, fee);
    }

    function exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) external override onlyRole(INVOKER_ROLE) returns (uint256) {
        return _exactInputSingle(onBehalfOf, tokenIn, amountIn, tokenOut, fee);
    }

    /**
     * @notice _exactInputSingle swaps a fixed amount of _tokenIn for a maximum possible amount of _tokenOut
     * using the _tokenIn/_tokenOut 0.3% pool by calling `exactInputSingle` in the swap router.
     * 
     * link: https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps
     * 
     * @dev The calling address must approve this contract to spend at least `amountIn` worth of its _tokenIn for this function to succeed.
     * @param onBehalfOf onBehalfOf
     * @param tokenIn token in
     * @param amountIn The exact amount of _tokenIn that will be swapped for _tokenOut.
     * @param tokenOut token out
     * @param fee swap pool fee
     * @return amountOut The amount of _tokenOut received.
     */
    function _exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee) internal returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Transfer the specified amount of _tokenIn to this contract.
        IERC20(tokenIn).safeTransferFrom(onBehalfOf, address(this), amountIn);

        // Approve the router to spend _tokenIn.
        IERC20(tokenIn).safeIncreaseAllowance(swapRouter, amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: onBehalfOf,
                deadline: block.number + 15,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = ISwapRouter(swapRouter).exactInputSingle(params);

        emit ExactInputSingled(onBehalfOf, tokenIn, amountIn, tokenOut, fee);
    }

    /**
     *  Used to control authorization of upgrade methods
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        view
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        newImplementation; // silence the warning
    }
}