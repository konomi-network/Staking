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
        // the address of staking contract, i.e. AAVE、Compound contract address.
        address stakingContract;

        // APY should be fetched dynamically
    }

    struct UserStake {
        // The id of staking token
        uint16 stakingId;
        // The amount of staking token
        uint256 amount;
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
    event Deposited(address who, uint8 comboId, uint256 amountIn, uint256 amountFee);
    event Redeemed(address who, uint16 stakingId, uint256 amount, uint256 reward);
    event AddCombo(address who, Combo newCombo);
    event RemoveCombo(address who, uint8 comboId, Combo oldCombo);
    event ExactStakingFee(address who, uint256 amountIn, uint256 fee);
    event RewardPumped(address who, uint256 extendTo);

    function listAllCombos() external view returns (Combo[] memory);
    function listUserStakeDetails(address _who) external view returns (UserStake[] memory);
    function averageAPY(uint8 _comboId) external view returns (uint256);
    
    function deposit(uint8 _comboId, uint256 _amountIn) external;
    function redeem(uint16 _stakingId) external;
}