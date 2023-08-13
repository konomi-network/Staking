// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SafeCast } from '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import "./interfaces/IEarningSwapRouter.sol";
import "./libraries/uniswap/IUniversalRouter.sol";

import "./libraries/uniswap/IAllowanceTransfer.sol";

contract EarningSwapRouter is IEarningSwapRouter, AccessControlUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // Who can invoke the pool method in this contract
    bytes32 public constant INVOKER_ROLE = keccak256("INVOKER");

    // The swapRouter of uniswap-v3
    address public swapRouter;
    address public permit2;

    // For upgrading contract versions
    uint16 public constant VERSION = 1;

    uint8 constant V3_SWAP_EXACT_IN = 0x00;
    uint8 constant PERMIT2_TRANSFER_FROM = 0x02;

    function initialize(address _swapRouter, address _permit2) external override initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        swapRouter = _swapRouter;
        permit2 = _permit2;
    }

    function setInvoker(address _invoker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setupRole(INVOKER_ROLE, _invoker);
    }

    function setSwapRouter(address _swapRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        swapRouter = _swapRouter;
    }

    function setPermit2(address _permit2) external onlyRole(DEFAULT_ADMIN_ROLE) {
        permit2 = _permit2;
    }

    function exactInputSingle(address tokenIn, uint256 amountIn, address tokenOut, uint24 fee) external override returns (uint256) {
        return _v3SwapExactInput(msg.sender, tokenIn, amountIn, tokenOut, fee);
    }

    function exactInputSingle(
        address onBehalfOf,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint24 fee
    ) external override onlyRole(INVOKER_ROLE) returns (uint256) {
        return _v3SwapExactInput(onBehalfOf, tokenIn, amountIn, tokenOut, fee);
    }

    function _v3SwapExactInput(
        address _onBehalfOf,
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint24 _fee
    ) internal returns (uint256 amountOut) {
        address _recipient =  address(this);

        IERC20(_tokenIn).safeTransferFrom(_onBehalfOf, _recipient, _amountIn);

        IERC20(_tokenIn).safeIncreaseAllowance(permit2, _amountIn);

        IAllowanceTransfer(permit2).approve(_tokenIn, swapRouter, _amountIn.toUint160(), uint48(_expiration()));
        
        amountOut = _universalRouterSwap(_recipient, _tokenIn, _amountIn, _tokenOut, _fee);

        IERC20(_tokenOut).safeTransfer(_onBehalfOf, amountOut);

        emit ExcutedV3SwapExactInput(_onBehalfOf, _tokenIn, _amountIn, _tokenOut, amountOut, _fee);
    }
    
    function _universalRouterSwap(
        address _recipient,
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut,
        uint24 _fee
    ) internal returns (uint256 amountOut) {
        uint256 amountBeforeSwap = IERC20(_tokenOut).balanceOf(_recipient);
        
        bytes memory commands = abi.encodePacked(
            bytes1(PERMIT2_TRANSFER_FROM),
            bytes1(V3_SWAP_EXACT_IN)
        );

        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(_tokenIn, swapRouter, _amountIn);
        inputs[1] = abi.encode(
            _recipient,
            _amountIn,
            1,      // amountOutMin
            abi.encodePacked(_tokenIn, _fee, _tokenOut),
            false    // payerIsUser
        );

        IUniversalRouter(swapRouter).execute({
            commands: commands,
            inputs: inputs,
            deadline: _expiration()
        });

        amountOut = IERC20(_tokenOut).balanceOf(_recipient) - amountBeforeSwap;
    }

    function _expiration() internal view returns (uint256) {
        return block.timestamp + 900;
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