// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import "./interfaces/IComboStaking.sol";
import "./staking/interfaces/IStakingPool.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 * 7Blocks supports multiple tokens, such as ETH, LINK, UNI and etc.
 * 7Blocks will package the staking options into several different Combos. 
 * 
 * For example:
 * Combo-AAA: 30% ETH staking + 70% LINK staking
 * Combo-C: 60% Doge staking + 40% Pepe staking
 * 
 * User can choose to stake to these different combos.
 */
contract ComboStaking is IComboStaking, AccessControlUpgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // The underlying staking token
    IERC20 public stakingToken;

    // The swapRouter of uniswap-v3
    address public swapRouter;

    // The combos of the staking options.
    Combo[] public combos;

    // The mapping that tracks all the users staking metadata
    mapping(address => UserStake[]) public userStakeDetail;
    // The mapping that tracks the total amount staked of an address
    mapping(address => uint256) public userTotalStake;

    // The total amount of token deposited into the contract
    uint256 public totalDeposit;

    // The total amount of reward for this contract
    uint256 public totalReward;

    // The total number of unique participants
    uint256 public totalParticipants;

    // The maximum deposit amount in total
    uint256 public maxDeposit;

    // The maximum deposit amount a user can stake
    uint256 public maxPerUserDeposit;

    // The minimal deposit amount
    uint256 public minDepositAmount;


    // Whether the staking has ended
    bool public stakingEnded;

    // Staking platform fee, default: 0.1%, when collect during deposit
    uint24 public stakingFee = 1000;

    // The fee unit
    uint24 public constant ONE_FEER = 10000;

    // Uniswap pool fee, 0.3%
    uint24 public constant ISWAP_POOL_FEE = 3000;

    // For upgrading contract versions
    uint16 public constant VERSION = 1;

    // Maximum number of staking per user
    uint16 private constant MAX_STAKING_PER_USER = 1024;

    // Maximum weight of staking token
    uint8 private constant MAX_STAKING_TOKEN_WEIGHT = 100;

    /**
     * Modifier to check staking has not ended
     * TODO: deprecate this, use a bool!
     */
    modifier notEnded() {
        require(!stakingEnded, "STAKE-1");
        _;
    }

    modifier _checkComboWeight(ComboEntry[] calldata entries) {
        uint8 totalWeight = 0;
        for (uint i = 0; i < entries.length; i++) {
            totalWeight += entries[i].weight;
        }

        require(totalWeight == MAX_STAKING_TOKEN_WEIGHT, "STAKE-2");
        _;
    }

    function initialize(
        address _stakingToken,
        uint24 _stakingFee,
        address _swapRouter,
        uint256 _maxDeposit,
        uint256 _maxPerUserDeposit,
        uint256 _minDepositAmount,
        Combo[] calldata _combos
    ) external override initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        __Ownable_init();
        __Pausable_init();

        _combosInit(_combos);

        stakingToken = IERC20(_stakingToken);
        stakingFee = _stakingFee;

        swapRouter = _swapRouter;

        totalDeposit = 0;
        totalReward = 0;
        totalParticipants = 0;

        maxDeposit = _maxDeposit;
        maxPerUserDeposit = _maxPerUserDeposit;
        minDepositAmount = _minDepositAmount;

        stakingEnded = false;
    }

    function _combosInit(Combo[] calldata _combos) internal {
        for (uint i = 0; i < _combos.length; i++) {
            _newCombo(_combos[i]);
        }
    }

    function _newCombo(Combo calldata combo) internal _checkComboWeight(combo.entries) {
        combos.push(combo);
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

    /**
     * Get all combos that can be deposit
     * @return combos - the array of Combo
     */
    function listAllCombos() external view override returns (Combo[] memory) {
        return combos;
    }

    /**
     * Get the staking amount that can be redeem
     * @param who The address to check
     */
    function listUserStakeDetails(address who) external view override returns (UserStake[] memory) {
        require(who == _msgSender() || owner() == _msgSender(), "STAKE-3");
        return userStakeDetail[who];
    }

    /**
     * @dev callback another contract to calc APY.
     * @param comboId the index of combo
     * @return currentAPY
     */
    function averageAPY(uint8 comboId) external view override returns (uint256 currentAPY) {
        require (combos.length > comboId, "STAKE-4");

        uint256 totalApy = 0;
        Combo memory combo = combos[comboId];
        for (uint i = 0; i < combo.entries.length; i++) {
            ComboEntry memory token = combo.entries[i];
            uint256 tokenApy = IStakingPool(token.staking.stakingContract).apy();
            totalApy += _calculateTokenAmount(tokenApy, token.weight);
            // console.log(">>> tokenApy:", token.staking.name, tokenApy, currentTime());
        }
        currentAPY = totalApy / combo.entries.length;
    }

    function deposit(uint8 comboId, uint256 amountIn) external override notEnded whenNotPaused {
        require (combos.length > comboId, "STAKE-4");

        if (totalDeposit + amountIn >= maxDeposit) {
            // The max deposit will be reached, cap the amount
            amountIn = amountIn.min(maxDeposit - totalDeposit);
            // _amount == 0 means max deposit is reached
            require(amountIn != 0, "STAKE-5");
        } else {
            require(amountIn >= minDepositAmount, "STAKE-6");
        }

        // Update user total stake amount
        uint256 userStake = userTotalStake[msg.sender] + amountIn;
        require(userStake <= maxPerUserDeposit, "STAKE-7");
        userTotalStake[msg.sender] = userStake;

        UserStake[] storage userStakes = userStakeDetail[msg.sender];

        // Update user staking details
        require(userStakes.length < MAX_STAKING_PER_USER, "STAKE-8");

        // Collect platform fees
        uint256 amountFee = _collectStakingFee(amountIn);
        amountIn -= amountFee;

        if (userStakes.length == 0) {
            totalParticipants += 1;
        }

        // Swapping the specified token as a Stacking Token combination
        Combo storage combo = combos[comboId];
        for (uint i = 0; i < combo.entries.length; i++) {
            ComboEntry storage token = combo.entries[i];

            uint256 tokenAmountIn = _calculateTokenAmount(amountIn, token.weight);
            uint256 tokenAmountOut = _swapExactInputSingle(address(stakingToken), tokenAmountIn, token.staking.token);

            // console.log(">>> deposit: ", token.staking.token, tokenAmountOut, tokenAmountIn);

            IStakingPool(token.staking.stakingContract).deposit(msg.sender, tokenAmountOut);

            // Add new combo to userStakeDetail storage
            userStakes.push(UserStake({
                stakingId: token.staking.id,
                amount: tokenAmountOut,
                stakedTime: currentTime()
            }));
        }

        // Update total deposit
        totalDeposit += amountIn;

        emit Deposited(msg.sender, comboId, amountIn, amountFee);
    }

    function redeem(uint16 stakingId) external override notEnded whenNotPaused {
        UserStake[] storage userStakes = userStakeDetail[msg.sender];
        require(userStakes.length > 0, "STAKE-9");
        require(userStakes.length > stakingId, "STAKE-4");

        UserStake memory userStake = userStakes[stakingId];

        // Get the user reward
        uint256 userReward = 0;
        // TODO: get averageAPY and calculateReward


        // Perform deduction
        uint256 totalDeduct = userReward + userStake.amount;

        totalReward -= userReward;
        totalDeposit -= userStake.amount;

        userTotalStake[msg.sender] -= userStake.amount;

        _deleteUserStake(msg.sender, stakingId);

        emit Redeemed(msg.sender, stakingId, userStake.amount, userReward);

        // Transfer
        stakingToken.transfer(msg.sender, totalDeduct);
    }

    /**
     * @dev get current time
     */
    function currentTime() public view returns (uint256) {
        return block.number;
    }

    /**
     * @dev Delete user stake by account address and stakingId
     * @param who account address
     * @param stakingId The id of staking
     */
    function _deleteUserStake(address who, uint16 stakingId) internal {
        UserStake[] storage userStakes = userStakeDetail[who];
        if (userStakes.length == 1) {
            delete userStakeDetail[who];
            delete userTotalStake[who];
            if (totalParticipants > 0) {
                totalParticipants -= 1;
            }
        } else {
            userStakeDetail[who][stakingId] = userStakeDetail[who][userStakes.length - 1];
            userStakeDetail[who].pop();
        }
    }

    /**
     * Collect staking fee
     * @param amountIn the amound of token
     * @return amountFee
     */
    function _collectStakingFee(uint256 amountIn) internal returns (uint256 amountFee) {
        amountFee = _calculatStakingFee(amountIn);
        stakingToken.safeTransferFrom(msg.sender, address(this), amountFee);
        emit ExactStakingFee(msg.sender, amountIn, amountFee);
    }

    /**
     * @dev Calculate staking fee
     * @param amountIn the amound of tokenIn
     * @return amountFee
     */
    function _calculatStakingFee(uint256 amountIn) internal view returns (uint256) {
        return amountIn * stakingFee / ONE_FEER;
    }

    /**
     * @dev Convert the corresponding quantity based on weight and price
     * @param amount the amound of tokenIn
     * @param stakingTokenWeight the weight of staking token
     * @return _stakingTokenAmount - the amount of staking token
     */
    function _calculateTokenAmount(uint256 amount, uint8 stakingTokenWeight) internal pure returns (uint256) {
        return amount * stakingTokenWeight / MAX_STAKING_TOKEN_WEIGHT;
    }

    /**
     * @notice _swapExactInputSingle swaps a fixed amount of _tokenIn for a maximum possible amount of _tokenOut
     * using the _tokenIn/_tokenOut 0.3% pool by calling `exactInputSingle` in the swap router.
     * 
     * link: https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps
     * 
     * @dev The calling address must approve this contract to spend at least `amountIn` worth of its _tokenIn for this function to succeed.
     * @param tokenIn token in
     * @param amountIn The exact amount of _tokenIn that will be swapped for _tokenOut.
     * @param tokenOut token out
     * @return amountOut The amount of _tokenOut received.
     */
    function _swapExactInputSingle(address tokenIn, uint256 amountIn, address tokenOut) internal returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Transfer the specified amount of _tokenIn to this contract.
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        // Approve the router to spend _tokenIn.
        TransferHelper.safeApprove(tokenIn, swapRouter, amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: ISWAP_POOL_FEE,
                recipient: msg.sender,
                deadline: currentTime() + 15,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = ISwapRouter(swapRouter).exactInputSingle(params);
    }

    /**
     * @notice just admin can do it
     * 
     * @dev Supply amount of reward into this contract
     * @param _amount The amount of reward
     */
    function supplyReward(uint256 _amount) external onlyOwner {
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        totalReward += _amount;

        emit RewardPumped(msg.sender, _amount);
    }

    /**
     * @dev support append and remove combo to combs? just support handle combo list
     * @param combo the stakingToken information of combo
     */
    function addCombo(Combo calldata combo) external onlyOwner {
        _newCombo(combo);

        emit AddCombo(msg.sender, combo);
    }

    /**
     * @dev Remove combo from _comboId
     * @param comboId the index of combo
     */
    function removeCombo(uint8 comboId) external onlyOwner {
        Combo memory oldCombo = combos[comboId];

        combos[comboId] = combos[combos.length - 1];
        combos.pop();

        emit RemoveCombo(msg.sender, comboId, oldCombo);
    }

    /**
     * @dev end staking
     */
    function endStaking() external onlyOwner {
        stakingEnded = true;
    }
}