// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import "./interfaces/IComboStaking.sol";

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
contract ComboStaking is IComboStaking, Initializable, AccessControlUpgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    ISwapRouter public swapRouter;

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

    // Uniswap pool fee, 0.3%
    uint24 public constant ISWAP_POOL_FEE = 3000;

    // For upgrading contract versions
    uint16 public constant VERSION = 1;

    // Maximum number of staking per user
    uint8 private constant MAX_STAKING_PER_USER = 255;

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

    modifier _checkComboWeight(ComboStakingToken[] calldata _tokens) {
        uint8 totalWeight = 0;
        for (uint i = 0; i < _tokens.length; i++) {
            totalWeight += _tokens[i].weight;
        }

        require(totalWeight == MAX_STAKING_TOKEN_WEIGHT, "STAKE-2");
        _;
    }

    function initialize(
        uint256 _maxDeposit,
        uint256 _maxPerUserDeposit,
        uint256 _minDepositAmount,
        ISwapRouter _swapRouter,
        Combo[] calldata _combos
    ) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        __Ownable_init();
        __Pausable_init();

        _combosInit(_combos);

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

    function _newCombo(Combo calldata _combo) internal _checkComboWeight(_combo.tokens) {
        combos.push(_combo);
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
     * @param _who The address to check
     */
    function listUserStakeDetails(address _who) external view override returns (UserStake[] memory) {
        require(_who == _msgSender() || owner() == _msgSender(), "STAKE-3");
        return userStakeDetail[_who];
    }

    /**
     * @dev callback another contract to calc APY.
     * @param _comboId the index of combo
     * @return APY
     */
    function averageAPY(uint8 _comboId) external view override returns (uint256) {
        return 1;
    }

    function deposit(uint8 _comboId, address _tokenIn, uint256 _amount) external override notEnded whenNotPaused {
        require (combos.length > _comboId, "STAKE-4");

        if (totalDeposit + _amount >= maxDeposit) {
            // The max deposit will be reached, cap the amount
            _amount = _amount.min(maxDeposit - totalDeposit);
            // _amount == 0 means max deposit is reached
            require(_amount != 0, "STAKE-5");
        } else {
            require(_amount >= minDepositAmount, "STAKE-6");
        }

        // Update user total stake amount
        uint256 userStake = userTotalStake[msg.sender] + _amount;
        require(userStake <= maxPerUserDeposit, "STAKE-7");
        userTotalStake[msg.sender] = userStake;

        UserStake[] storage userStakes = userStakeDetail[msg.sender];

        // Update user staking details
        require(userStakes.length < MAX_STAKING_PER_USER, "STAKE-8");
        if (userStakes.length == 0) {
            totalParticipants += 1;
        }

        // Swapping the specified token as a Stacking Token combination
        Combo storage combo = combos[_comboId];
        for (uint i = 0; i < combo.tokens.length; i++) {
            ComboStakingToken storage token = combo.tokens[i];

            uint256 amountIn = _calculateStakingTokenAmount(_amount, token);

            uint256 amount = _swapExactInputSingle(_tokenIn, amountIn, token.staking.token);
            uint256 stakedTime = currentTime();

            // Add new combo to userStakeDetail storage
            userStakes.push(UserStake({
                stakingTokenId: token.staking.id,
                amount: amount,
                stakedTime: stakedTime
            }));
        }

        // Update total deposit
        totalDeposit += _amount;

        emit Deposited(msg.sender, _comboId, _tokenIn, _amount);
    }

    function redeem(uint8 _comboId) external override notEnded whenNotPaused {
        require(userStakeDetail[msg.sender].length > 0, "STAKE-9");
        require(userStakeDetail[msg.sender].length > _comboId, "STAKE-4");

        UserStake memory userStake = userStakeDetail[msg.sender][_comboId];

        emit Redeemed(msg.sender, _comboId);
    }

    /**
     * @dev support append and remove combo to combs? just support handle combo list
     * @param _combo the stakingToken information of combo
     */
    function addCombo(Combo calldata _combo) external onlyOwner {
        _newCombo(_combo);

        emit AddCombo(msg.sender, _combo);
    }

    /**
     * @dev Remove combo from _comboId
     * @param _comboId the index of combo
     */
    function removeCombo(uint8 _comboId) external onlyOwner {
        Combo memory oldCombo = combos[_comboId];

        combos[_comboId] = combos[combos.length - 1];
        combos.pop();

        emit RemoveCombo(msg.sender, _comboId, oldCombo);
    }

    /**
     * @dev end staking
     */
    function endStaking() external onlyOwner {
        stakingEnded = true;
    }

    /**
     * @dev get current time
     */
    function currentTime() public view returns (uint256) {
        return block.number;
    }

    /**
     * @dev Convert the corresponding quantity based on weight and price
     * @param _amount the amound of source token
     * @param _stakingToken the staking token
     * @return _stakingTokenAmount the amount of staking token
     * 
     * TODO: How to get token price??
     */
    function _calculateStakingTokenAmount(
        uint256 _amount,
        ComboStakingToken memory _stakingToken
    ) internal pure returns (uint256) {
        return _amount * _stakingToken.weight / MAX_STAKING_TOKEN_WEIGHT;
    }

    /**
     * @notice _swapExactInputSingle swaps a fixed amount of _tokenIn for a maximum possible amount of _tokenOut
     * using the _tokenIn/_tokenOut 0.3% pool by calling `exactInputSingle` in the swap router.
     * 
     * link: https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps
     * 
     * @dev The calling address must approve this contract to spend at least `amountIn` worth of its _tokenIn for this function to succeed.
     * @param _tokenIn token in
     * @param _amountIn The exact amount of _tokenIn that will be swapped for _tokenOut.
     * @param _tokenOut token out
     * @return amountOut The amount of _tokenOut received.
     */
    function _swapExactInputSingle(address _tokenIn, uint256 _amountIn, address _tokenOut) internal returns (uint256 amountOut) {
        // msg.sender must approve this contract

        // Transfer the specified amount of _tokenIn to this contract.
        TransferHelper.safeTransferFrom(_tokenIn, msg.sender, address(this), _amountIn);

        // Approve the router to spend _tokenIn.
        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: ISWAP_POOL_FEE,
                recipient: msg.sender,
                deadline: currentTime() + 15,
                amountIn: _amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }
}