// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import "./interfaces/IEarning.sol";
import "./earning/interfaces/IEarningPool.sol";
import "./ErrorReporter.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 * 7Blocks supports multiple tokens, such as ETH, LINK, UNI and etc.
 * 7Blocks will package the earning options into several different Combos. 
 * 
 * For example:
 * Combo-AAA: 30% ETH earning + 70% LINK earning
 * Combo-C: 60% Doge earning + 40% Pepe earning
 * 
 * User can choose to earn to these different combos.
 */
contract Earning is IEarning, ErrorReporter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // The underlying earning token
    IERC20 public earningToken;

    // The swapRouter of uniswap-v3
    address public swapRouter;

    // The combos of the earning options.
    Combo[] public combos;

    // The mapping that tracks all the users earning metadata
    mapping(address => UserEarn[]) public userEarnDetail;
    // The mapping that tracks the total amount earned of an address
    mapping(address => uint256) public userTotalEarn;
    // The mapping that tracks the id of earningToken
    mapping(uint16 => EarningToken) public earningTokens;

    // The total amount of token deposited into the contract
    mapping(address => uint256) public totalDeposit;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // The total number of unique participants
    uint256 public totalParticipants;

    // The maximum deposit amount a user can earn
    uint256 public maxPerUserDeposit;

    // The minimal deposit amount
    uint256 public minDepositAmount;

    // Whether the earning has ended
    bool public earningEnded;

    // Earning platform fee, default: 0.1%, when collect during deposit
    uint24 public earningFee;

    // The fee unit
    uint24 private constant ONE_FEER = 10000;

    // Uniswap pool fee, 0.3%
    uint24 private constant ISWAP_POOL_FEE = 3000;

    // For upgrading contract versions
    uint16 public constant VERSION = 1;

    // Maximum number of earning per user
    uint16 private constant MAX_EARNING_PER_USER = 1000;

    // Maximum weight of earning token
    uint8 private constant MAX_EARNING_TOKEN_WEIGHT = 100;

    /**
     * Modifier to check earning has not ended
     * TODO: deprecate this, use a bool!
     */
    modifier notEnded() {
        if (earningEnded) {
            revert EarningEnded();
        }
        _;
    }

    modifier _checkCombo(ComboEntry[] calldata entries) {
        uint8 totalWeight = 0;
        for (uint i = 0; i < entries.length; i++) {
            ComboEntry calldata entry = entries[i];
            
            // NOT exists in storage
            EarningToken storage eranInfo = earningTokens[entry.earning.id];
            if (eranInfo.earningContract != address(0)) {
                revert EarningConfigContractAlreadyExist();
            }

            totalWeight += entry.weight;
        }

        if (totalWeight != MAX_EARNING_TOKEN_WEIGHT) {
            revert EarningConfigIncorrectWeight();
        }
        _;
    }

    function initialize(
        address _earningToken,
        uint24 _earningFee,
        address _swapRouter,
        uint256 _maxPerUserDeposit,
        uint256 _minDepositAmount,
        Combo[] calldata _combos
    ) external override initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        __Pausable_init();

        _combosInit(_combos);

        earningToken = IERC20(_earningToken);
        earningFee = _earningFee;

        swapRouter = _swapRouter;

        totalParticipants = 0;

        maxPerUserDeposit = _maxPerUserDeposit;
        minDepositAmount = _minDepositAmount;

        earningEnded = false;
        _status = _NOT_ENTERED;
    }

    function _combosInit(Combo[] calldata _combos) internal {
        for (uint i = 0; i < _combos.length; i++) {
            _newCombo(_combos[i]);
        }
    }

    function _newCombo(Combo calldata combo) internal _checkCombo(combo.entries) {
        combos.push(combo);

        for (uint i = 0; i < combo.entries.length; i++) {
            EarningToken calldata token = combo.entries[i].earning;
            earningTokens[token.id] = token;
        }
    }

    function _removeCombo(uint8 comboId) internal returns (Combo memory oldCombo) {
        if (combos.length <= comboId) {
            revert EarningIdNotExist();
        }

        oldCombo = combos[comboId];

        combos[comboId] = combos[combos.length - 1];
        combos.pop();

        for (uint i = 0; i < oldCombo.entries.length; i++) {
            delete earningTokens[oldCombo.entries[i].earning.id];
        }
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
     * Get the earning amount that can be redeem
     */
    function listUserEarnDetail() external view override returns (UserEarn[] memory) {
        return userEarnDetail[msg.sender];
    }

    /**
     * @dev callback another contract to calc APY.
     * @param comboId the index of combo
     * @return currentAPY
     */
    function averageAPY(uint8 comboId) external view override returns (uint256 currentAPY) {
        if (combos.length <= comboId) {
            revert EarningIdNotExist();
        }

        uint256 totalApy = 0;
        Combo memory combo = combos[comboId];
        for (uint i = 0; i < combo.entries.length; i++) {
            ComboEntry memory token = combo.entries[i];
            uint256 tokenApy = IEarningPool(token.earning.earningContract).apy();
            totalApy += _calculateTokenAmount(tokenApy, token.weight);
            // console.log(">>> tokenApy:", token.earning.name, tokenApy, currentTime());
        }
        currentAPY = totalApy / combo.entries.length;
    }

    function deposit(uint8 comboId, uint256 amountIn) external override notEnded whenNotPaused nonReentrant {
        if (combos.length <= comboId) {
            revert EarningIdNotExist();
        }

        if (amountIn < minDepositAmount) {
            revert DepositMustBeExceedMinimumAmount();
        }

        // Update user total earn amount
        uint256 userEarnAmount = userTotalEarn[msg.sender] + amountIn;
        if (userEarnAmount > maxPerUserDeposit) {
            revert DepositReachedMaximumAmountPerUser();
        }
        userTotalEarn[msg.sender] = userEarnAmount;

        UserEarn[] storage userEarns = userEarnDetail[msg.sender];
        if (userEarns.length >= MAX_EARNING_PER_USER) {
            revert DepositReachedMaximumNumberPerUser();
        }

        // Collect platform fees
        uint256 amountFee = _collectEarningFee(amountIn);
        amountIn -= amountFee;

        if (userEarns.length == 0) {
            totalParticipants += 1;
        }

        // Swapping the specified token as a Stacking Token combination
        Combo storage combo = combos[comboId];
        for (uint i = 0; i < combo.entries.length; i++) {
            ComboEntry storage entry = combo.entries[i];
            EarningToken storage earnInfo = entry.earning;

            uint256 tokenAmountIn = _calculateTokenAmount(amountIn, entry.weight);
            uint256 tokenAmountOut = _swapExactInputSingle(address(earningToken), tokenAmountIn, earnInfo.token);

            // console.log(">>> deposit:", token.earning.token, tokenAmountOut, tokenAmountIn);

            IEarningPool(earnInfo.earningContract).deposit(msg.sender, tokenAmountOut);

            // Add new combo to userEarnDetail storage
            userEarns.push(UserEarn({
                earningId: earnInfo.id,
                amount: tokenAmountOut,
                earnedTime: currentTime()
            }));
            
            // Update total deposit
            totalDeposit[earnInfo.token] += amountIn;
        }

        emit Deposited(msg.sender, comboId, amountIn, amountFee);
    }

    function redeem(uint16 earningId) external override notEnded whenNotPaused nonReentrant {
        UserEarn[] storage userEarns = userEarnDetail[msg.sender];
        if (userEarns.length <= 0) {
            revert EarningIsEmpty();
        }

        if (userEarns.length <= earningId) {
            revert EarningIdNotExist();
        }

        UserEarn memory userEarn = userEarns[earningId];

        EarningToken storage earnInfo = earningTokens[userEarn.earningId];
        if (earnInfo.earningContract == address(0)) {
            revert EarningConfigContractNotExist();
        }

        // Get the user reward
        uint256 userReward = IEarningPool(earnInfo.earningContract).reward(msg.sender, userEarn.earnedTime);

        // Perform deduction
        uint256 totalDeduct = userReward + userEarn.amount;

        // console.log(">>> redeem:", userReward, userEarn.amount, currentTime());

        totalDeposit[earnInfo.token] -= userEarn.amount;

        userTotalEarn[msg.sender] -= userEarn.amount;

        _deleteUserEarn(msg.sender, earningId);

        emit Redeemed(msg.sender, earningId, earnInfo.token, userEarn.amount, userReward);

        // Transfer
        IEarningPool(earnInfo.earningContract).redeem(msg.sender, totalDeduct);
    }

    /**
     * @dev get current time
     */
    function currentTime() public view returns (uint256) {
        return block.number;
    }

    /**
     * @dev Delete user earn by account address and earningId
     * @param who account address
     * @param earningId The id of earning
     */
    function _deleteUserEarn(address who, uint16 earningId) internal {
        UserEarn[] storage userEarns = userEarnDetail[who];
        if (userEarns.length == 1) {
            delete userEarnDetail[who];
            delete userTotalEarn[who];
            if (totalParticipants > 0) {
                totalParticipants -= 1;
            }
        } else {
            userEarnDetail[who][earningId] = userEarnDetail[who][userEarns.length - 1];
            userEarnDetail[who].pop();
        }
    }

    /**
     * Collect earning fee
     * @param amountIn the amound of token
     * @return amountFee
     */
    function _collectEarningFee(uint256 amountIn) internal returns (uint256 amountFee) {
        amountFee = _calculatEarningFee(amountIn);
        earningToken.safeTransferFrom(msg.sender, address(this), amountFee);
        emit ExactedEarningFee(msg.sender, amountIn, amountFee);
    }

    /**
     * @dev Calculate earning fee
     * @param amountIn the amound of tokenIn
     * @return fee - the fee of earning contract
     */
    function _calculatEarningFee(uint256 amountIn) internal view returns (uint256 fee) {
        unchecked {
            fee = amountIn * earningFee / ONE_FEER;
        }
    }

    /**
     * @dev Convert the corresponding quantity based on weight and price
     * @param amount the amound of tokenIn
     * @param earningTokenWeight the weight of earning token
     * @return earningTokenAmount - the amount of earning token
     */
    function _calculateTokenAmount(uint256 amount, uint8 earningTokenWeight) internal pure returns (uint256 earningTokenAmount) {
        unchecked {
            earningTokenAmount = amount * earningTokenWeight / MAX_EARNING_TOKEN_WEIGHT;
        }
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
     * @param amount The amount of reward
     */
    function supplyReward(uint16 earningId, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        EarningToken storage earnInfo = earningTokens[earningId];
        if (earnInfo.earningContract == address(0)) {
            revert EarningConfigContractNotExist();
        }

        // console.log(">>> supplyReward:", earningId, earnInfo.token, amount);

        IEarningPool(earnInfo.earningContract).deposit(msg.sender, amount);

        emit RewardPumped(msg.sender, amount);
    }

    /**
     * @dev support append and remove combo to combs? just support handle combo list
     * @param combo the earningToken information of combo
     */
    function addCombo(Combo calldata combo) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (combos.length >= type(uint8).max) {
            revert EarningConfigReachedMaximumAmount();
        }

        _newCombo(combo);

        emit AddedCombo(msg.sender, combo);
    }

    /**
     * @dev Remove combo from _comboId
     * @param comboId the index of combo
     */
    function removeCombo(uint8 comboId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Combo memory oldCombo = _removeCombo(comboId);

        emit RemovedCombo(msg.sender, comboId, oldCombo);
    }

    /**
     * @dev end earning
     */
    function endEarning() external onlyRole(DEFAULT_ADMIN_ROLE) {
        earningEnded = true;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}