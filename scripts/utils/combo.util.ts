export interface TokenInfo {
    name: string;
    token: string;
    earningContract: string;
}

export interface EarningToken {
    id: number;
    name: string;
    token: string;
    earningContract: string;
}

export interface ComboEntry {
    weight: number;
    earning: EarningToken;
}

export interface Combo {
    creditRating: number;
    entries: ComboEntry[];
}

export function makeEarningToken(id: number, tokenInfo: TokenInfo): EarningToken {
    return {
        id: id,
        ...tokenInfo
    }
}

export function makeCombo(weight: number, earningToken: EarningToken): ComboEntry {
    return {
        weight: weight,
        earning: earningToken
    };
}
