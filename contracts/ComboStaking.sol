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

    // The combos of the staking options.
    Combo[] public combos;

    // The mapping that tracks all the users staking metadata
    //
    // @dev Get Combo method:
    // Combo[] memory userStake = userStakeDetail[msg.sender]
    // Combo combo = userStake[comboId]
    mapping(address => Combo[]) public userStakeDetail;
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
        Combo[] calldata _combos
    ) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        __Ownable_init();
        __Pausable_init();

        _combosInit(_combos);

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
            _setCombo(combos[i], _combos[i]);
        }
    }

    function _setCombo(Combo storage combo, Combo calldata _combo) internal _checkComboWeight(_combo.tokens) {
        for (uint i = 0; i < _combo.tokens.length; i++) {
            combo.tokens[i] = _combo.tokens[i];
        }
        combo.creditRating = _combo.creditRating;
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
    function listUserStakeDetails(address _who) external view override returns (Combo[] memory) {
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

    function deposit(uint8 _comboId, address _sourceToken, uint256 _amount) external override notEnded whenNotPaused {
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

        Combo[] storage userCombos = userStakeDetail[msg.sender];

        // Update user staking details
        require(userCombos.length < MAX_STAKING_PER_USER, "STAKE-8");
        if (userCombos.length == 0) {
            totalParticipants += 1;
        }

        Combo memory combo = combos[_comboId];

        Combo storage userCombo = userCombos[userCombos.length];
        userCombo.creditRating = combo.creditRating;
        
        for (uint i = 0; i < combo.tokens.length; i++) {
            ComboStakingToken memory token = combo.tokens[i];
            token.staking.stakedTime = currentTime();
            token.staking.amount = _calculateStakingTokenAmount(_sourceToken, _amount, token);

            userCombo.tokens[i] = token;
        }

        // Update total deposit
        totalDeposit += _amount;

        emit Deposited(msg.sender, _comboId, _sourceToken, _amount);
    }

    function redeem(uint8 _comboId) external override notEnded whenNotPaused {

    }

    /**
     * @dev support append and remove combo to combs? just support handle combo list
     * @param _combo the stakingToken information of combo
     */
    function appendCombo(Combo calldata _combo) external onlyOwner {
        _setCombo(combos[combos.length], _combo);
    }

    /**
     * @dev Remove combo from _comboId
     * @param _comboId the index of combo
     */
    function removeCombo(uint8 _comboId) external onlyOwner {
        combos[_comboId] = combos[combos.length - 1];
        combos.pop();
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
     * 
     * @param _sourceToken the source token
     * @param _amount the amound of source token
     * @param _stakingToken the staking token
     * @return _stakingTokenAmount the amount of staking token
     * 
     * TODO: How to get token price??
     */
    function _calculateStakingTokenAmount(
        address _sourceToken,
        uint256 _amount,
        ComboStakingToken memory _stakingToken
    ) internal pure returns (uint256) {
        return _amount * _stakingToken.weight / MAX_STAKING_TOKEN_WEIGHT;
    }
}