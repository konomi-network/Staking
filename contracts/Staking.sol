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
contract Staking is Initializable, AccessControlUpgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Math for uint256;
    using SafeERC20 for IERC20;

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
        StakingToken staking;
        uint16 weight;
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

    // The combos of the staking options.
    Combo[] public combos;

    // The mapping that tracks all the users staking metadata
    //
    // @dev Get Combo method:
    // Combo[] memory userStake = userStakeDetail[msg.sender]
    // Combo combo = userStake[comboId]
    mapping(address => Combo[]) public userStakeDetail;

    // Whether the staking has ended
    bool public stakingEnded;

    // For upgrading contract versions
    uint16 public constant VERSION = 1;

    // Maximum number of stacking per user
    uint8 private constant MAX_STACKING_PER_USER = 255;


    /**
     * Modifier to check staking has not ended
     * TODO: deprecate this, use a bool!
     */
    modifier notEnded() {
        require(!stakingEnded, "STAKE-1");
        _;
    }

    function initialize(
        Combo[] calldata _combos
    ) external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        __Ownable_init();
        __Pausable_init();

        for (uint256 i = 0; i < _combos.length; i++) {
            Combo storage combo = combos[i];

            Combo calldata _combo = _combos[i];
            for (uint256 j = 0; j < _combo.tokens.length; j++) {
                combo.tokens[j] = _combo.tokens[j];
            }
            combo.creditRating = _combo.creditRating;
        }

        stakingEnded = false;
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

    function listAllCombos() external view returns (Combo[] memory) {
        return combos;
    }

    /**
     * @dev callback another contract to calc APY.
     * @param _comboId the index of combo
     */
    function averageAPY(uint8 _comboId) external view returns (uint256) {
        return 1;
    }

    function deposit(uint8 _comboId, uint256 _amount) external notEnded whenNotPaused {

    }

    function redeem(uint8 _comboId) external notEnded whenNotPaused {

    }

    /**
     * @dev support append and remove combo to combs? just support handle combo list
     * @param _combo the stakingToken information of combo
     */
    function appendCombo(Combo calldata _combo) external onlyOwner {
        combos.push(_combo);
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
}