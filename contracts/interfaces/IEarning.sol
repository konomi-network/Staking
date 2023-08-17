// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEarning {
    struct EarningToken {
        // the id of the earning, i.e. eth might have multiple earning options
        uint16 id;
        // token name, i.e. ETH、LINK、UNI etc.
        string name;
        // the address of token, i.e. ETH、LINK、UNI token address.
        address token;
        // the address of earning contract, i.e. AAVE、Compound contract address.
        address earningContract;

        // APY should be fetched dynamically
    }

    struct UserEarn {
        // The id of earning token
        uint16 earningId;
        // The amount of earning token
        uint256 amount;
        // The time that the user performed the earning
        uint256 earnedTime;
    }

    struct ComboEntry {
        // Earning Token
        EarningToken earning;
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
        ComboEntry[] entries;
        CreditRating creditRating;
    }

    /// Events
    event Deposited(address who, uint8 comboId, uint256 amountIn, uint256 amountFee);
    event Redeemed(address who, uint16 earningId, address token, uint256 amount, uint256 reward);
    event AddedCombo(address who, Combo newCombo);
    event RemovedCombo(address who, uint8 comboId, Combo oldCombo);
    event ExactedEarningFee(address who, uint256 amountIn, uint256 fee);
    event RewardPumped(address who, uint256 extendTo);
    event UpdatedSwapRouter(address who, address swapRouter);
    event UpdatedMaxPerUserDeposit(address who, uint256 amount);
    event UpdateMinDepositAmount(address who, uint256 amount);

    /// Methods
    function initialize(
        address _earningToken,
        uint24 _earningFee,
        address _swapRouter,
        uint256 _maxPerUserDeposit,
        uint256 _minDepositAmount,
        Combo[] calldata _combos
    ) external;
    
    function listAllCombos() external view returns (Combo[] memory);
    function listUserEarnDetail() external view returns (UserEarn[] memory);

    function averageAPY(uint8 comboId) external returns (uint256);
    
    function deposit(uint8 comboId, uint256 amountIn) external;
    function redeem(uint16 earningId) external;
}