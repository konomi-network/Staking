// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../earning/interfaces/ICompoundV2.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract MockCToken is CErc20, ERC20 {
    uint128 n = 1;

    constructor() ERC20("cToken", "cToken") {}

    function mint(uint amount) external override returns (uint256) {
        console.log(">>> MockCToken mint:", amount);

        _mint(address(this), amount);
        return 0;
    }

    function redeem(uint amount) external override returns (uint) {
        console.log(">>> MockCToken redeem:", amount);
        
        _burn(address(this), amount);
        return 0;
    }

    function supplyRatePerBlock() external view override returns (uint256 rateByPerBlock) {
        rateByPerBlock = 37893605000 * n; //1e16;

        console.log(">>> MockCToken supplyRatePerBlock:", rateByPerBlock, block.number, block.timestamp);
    }
    
    function mockN(uint128 _n) external {
        n = _n;
    }
}