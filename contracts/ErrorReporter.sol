// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ErrorReporter {
    uint256 public constant NO_ERROR = 0; // support legacy return codes
    
    error EarningEnded();
    error EarningConfigIncorrectWeight();
    error EarningConfigContractAlreadyExist();
    error EarningConfigContractNotExist();
    error EarningConfigReachedMaximumAmount();

    error EarningIdNotExist();
    error EarningIsEmpty();

    error MintComptrollerRejection(uint256 errorCode);
    error RedeemComptrollerRejection(uint256 errorCode);

    error DepositMustBeExceedMinimumAmount();
    error DepositReachedMaximumNumberPerUser();
    error DepositReachedMaximumAmountPerUser();
    error DepositAmountMustBeGreaterThanZero();
    error RedeemAmountMustBeGreaterThanZero();

    error ReentrancyGuardReentrantCall();
}