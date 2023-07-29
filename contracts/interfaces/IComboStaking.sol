// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IComboStaking {
    struct StakingToken {
        // the id of the staking, i.e. eth might have multiple staking options
        uint16 id;
        // token name, i.e. ETH、LINK、UNI etc.
        string name;
        // the address of token, i.e. ETH、LINK、UNI token address.
        address token;
        // the amount of token
        uint256 amount;
        // APY should be fetched dynamically
        // The time that the user performed the staking
        uint256 stakedTime;
    }

    struct ComboStakingToken {
        // Staking Token
        StakingToken staking;
        // Contract weight, range 0-100
        uint8 weight;
    }

    enum CreditRating {  
        AAA,
        AA,
        A,
        BBB,
        BB,
        B,
        CCC,
        CC,
        C,
        D
    }

    struct Combo {
        ComboStakingToken[] tokens;
        CreditRating creditRating;
    }

    /// Events
    event Deposited(address who, uint8 comboId, address sourceToken, uint256 amount);
    event Redeemed(address who, uint8 comboId);

    function listAllCombos() external view returns (Combo[] memory);
    function listUserStakeDetails(address _who) external view returns (Combo[] memory);
    function averageAPY(uint8 _comboId) external view returns (uint256);
    
    function deposit(uint8 _comboId, address _sourceToken, uint256 _amount) external;
    function redeem(uint8 _comboId) external;
}