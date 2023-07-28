# 7Blocks
You can think of 7Blocks as two-phase product. 

For phase 1, we are creating a decentralized staking aggregator. By making a deposit (using usdt) on 7Blocks, 7Blocks will deposit the tokens into official staking pools and earn interests. After the token is deposited, 7Blocks will issue the depositor an NFT that contains the metadata of the staking. Depositors can redeem their funds with the NFT.

For phase 2, the NFT can be converted to a stable coin, usbt. With usbt, one can swap to usdt and stake on 7Blocks again.


## Phase 1 Design
7Blocks supports multiple tokens, such as ETH, LINK, UNI and etc. 7Blocks will package the staking options into several different Combos. For example:
```
Combo-AAA:
30% ETH staking + 70% LINK staking

Combo-C
60% Doge staking + 40% Pepe staking
```
User can choose to stake to these different combos.
 
For the contract interface, we have:
```solidity
struct SubStaking {
    uint16 id, // the id of the staking, i.e. eth might have multiple staking options
    address token,
    address stakingContract,

    // APY should be fetched dynamically
}

// interface with different staking protocol
contract SubStakingPool {
    function apy();
    function deposit(amount);
    function redeem(amount);
    function reward(depositBlock);
}

struct ComboEntry {
    SubStaking staking,
    uint16 percentage;
}

struct Combo {
    ComboEntry[] entries
}

contract Staking {
    Combo[] combos;

    function listAllCombos();
    function averageAPY(comboId);
    function deposit(comboId, amount);
    function redeem(nftTokenId);
}
```