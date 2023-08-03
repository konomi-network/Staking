import { TokenInfo, makeCombo} from './utils/combo.util';

export const ethTokenAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
export const linkTokenAddress = '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4';

export function makeCombos(ethEarningPoolContractAddress: string, linkEarningPoolContractAddress: string) {
    const tokenWeth: TokenInfo = {
        id: 0,
        tokenName: 'WETH',
        tokenAddress: ethTokenAddress,
        earningPoolContractAddress: ethEarningPoolContractAddress,
    }

    const tokenLink: TokenInfo = {
        id: 1,
        tokenName: 'LINK',
        tokenAddress: linkTokenAddress,
        earningPoolContractAddress: linkEarningPoolContractAddress,
    }

    return [{
        creditRating: 0,
        entries: [
            makeCombo(30, tokenWeth),
            makeCombo(70, tokenLink),
        ]
    }]    
}