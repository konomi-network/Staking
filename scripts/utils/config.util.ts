export interface SystemConfig {
    aavePoolAddress: string;
    aTokenAddress: string;
    cTokenAddress: string;
    uniswapRouterAddress: string;
    earningTokenAddress: string;

    platformFee: number;
    maxPerUserDeposit: number;
    minDepositAmount: number;
    maxInterestRate: number;
}
