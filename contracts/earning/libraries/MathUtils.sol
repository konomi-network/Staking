// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WadMath.sol";

library MathUtils {
    using WadMath for uint256;

    /**
     * @dev Function to calculate the interest using a compounded interest rate formula
     * To avoid expensive exponentiation, the calculation is performed using a binomial approximation:
     *
     *  (1+x)^n = 1+n*x + [n/2*(n-1)]*x^2 + [n/6*(n-1)*(n-2)*x^3...
     * 
     * ref: https://en.wikipedia.org/wiki/Binomial_series
     *
     * The approximation slightly underpays liquidity providers and undercharges borrowers, with the advantage of great
     * gas cost reductions. The whitepaper contains reference to the approximation and a table showing the margin of
     * error per different time periods
     *
     * @param rate The interest rate, in wad
     * @param exp n
     * @return The interest rate compounded during the timeDelta, in wad
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint256 exp
    ) internal pure returns (uint256) {
        uint256 expMinusOne;
        uint256 expMinusTwo;
        uint256 basePowerTwo;
        uint256 basePowerThree;
        unchecked {
            expMinusOne = exp - 1;

            expMinusTwo = exp > 2 ? exp - 2 : 0;

            basePowerTwo = rate.wadMul(rate);
            basePowerThree = basePowerTwo.wadMul(rate);
        }

        uint256 secondTerm = exp * expMinusOne * basePowerTwo;
        unchecked {
            secondTerm /= 2;
        }

        uint256 thirdTerm = exp * expMinusOne * expMinusTwo * basePowerThree;
        unchecked {
            thirdTerm /= 6;
        }

        return WadMath.WAD + (rate * exp) + secondTerm + thirdTerm;
    }
}