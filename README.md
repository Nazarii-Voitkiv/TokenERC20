# MyTokenERC20

**MyTokenERC20** is a custom ERC-20 token built with OpenZeppelin.
It extends the base ERC-20 standard by adding features such as transaction fees, a whitelist, transfer limits, a pause mechanism, and free token claiming for new users.

---

## Tech Stack

- Solidity 0.8.20
- Hardhat 2.22.5
- Ethers.js 5.8.0
- OpenZeppelin Contracts 5.4.0

---

## Project Structure

```
MyTokenERC20/
│
├── contracts/
│   └── MyToken.sol              # Main ERC-20 token contract
│
├── scripts/
│   └── deploy.js                # Deployment script
│
├── hardhat.config.js            # Hardhat configuration
├── package.json
└── README.md
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start a local Hardhat node

```bash
npx hardhat node
```

### 3. Deploy the contract

In a new terminal window:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

After deployment, you will see:

```
MyToken deployed to: 0x...
```

---

## Contract Features

| Function                 | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `claimFreeTokens()`      | Allows a user to claim 100 free tokens once                              |
| `setFeeBps(uint256)`     | Sets the transaction fee (in basis points, 100 = 1%)                     |
| `setTreasury(address)`   | Defines the treasury address that receives the fee                       |
| `setMaxTransferAmount(uint256)` | Sets the maximum allowed transfer amount                               |
| `pause()` / `unpause()`  | Pauses or resumes all token transfers                                    |
| `setWhitelisted(address,bool)` | Adds or removes an address from the whitelist                          |
| `_update()`              | Overridden ERC20 internal function to handle custom rules (fee, whitelist, pause, transfer limit) |

---

## `_update()` Logic Overview

The `_update()` function executes during every token transfer and applies the following logic:

1.  **Mint/Burn**: Transfers involving the zero address bypass checks.
2.  **Whitelist**: Whitelisted users skip fee and limit checks.
3.  **Pause Check**: Reverts transfers while the contract is paused.
4.  **Fee**: Applies a transaction fee sent to the treasury address.
5.  **Transfer Limit**: Restricts transfers above the defined limit.

---

## Requirements

- Node.js version ≤ 20.x
- npm 8+