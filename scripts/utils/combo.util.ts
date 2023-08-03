export interface TokenInfo {
    id: number;
    tokenName: string;
    tokenAddress: string;
    earningPoolContractAddress: string;
}

export function makeCombo(weight: number, token: TokenInfo) {
    return {
        weight: weight,
        earning: {
            id: token.id,
            name: token.tokenName,
            token: token.tokenAddress,
            earningContract: token.earningPoolContractAddress,
        }
    };
}
