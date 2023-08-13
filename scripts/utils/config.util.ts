export interface SystemConfig {
    aavePoolAddress: string;
    aTokenAddress: string;
    cTokenAddress: string;
    uniswapRouterAddress: string;
    uniswapPermit2Address: string;
    earningTokenAddress: string;

    platformFee: number;
    maxPerUserDeposit: bigint;
    minDepositAmount: bigint;
    maxInterestRate: number;
}
