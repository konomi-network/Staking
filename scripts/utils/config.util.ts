export interface SystemConfig {
    // aave v3
    aavePoolAddress: string;
    aTokenAddress: string;
    // compound v2
    cTokenAddress: string;
    // compound v3;
    cometAddress: string;
    // uniswap v3
    uniswapRouterAddress: string;
    uniswapPermit2Address: string;
    // earning token
    earningTokenAddress: string;

    platformFee: number;
    maxPerUserDeposit: string;
    minDepositAmount: string;
    maxInterestRate: number;
}
