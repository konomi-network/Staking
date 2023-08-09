// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract MockAToken is ERC20Upgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory name, string memory symbol) initializer public {
        __ERC20_init(name, symbol);
    }

    function mint(address to, uint256 value) public returns (bool) {
        _mint(to, value);
        return true;
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }


    function upgradeTo(address newImplementation) public pure {
        newImplementation; // silence the warning
    }
}