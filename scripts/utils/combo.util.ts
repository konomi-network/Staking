export interface TokenInfo {
    id: number;
    name: string;
    token: string;
    earningContract: string;
}

export interface ComboEntry {
    weight: number;
    earning: TokenInfo;
}

export interface Combo {
    creditRating: number;
    entries: ComboEntry[];
}

export function makeCombo(weight: number, tokenInfo: TokenInfo): ComboEntry {
    return {
        weight: weight,
        earning: tokenInfo
    };
}
