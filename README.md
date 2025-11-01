# MyTokenERC20

**MyTokenERC20** is a custom ERC-20 token built with OpenZeppelin.
It extends the base ERC-20 standard by adding features such as transaction fees, a whitelist, transfer limits, a pause mechanism, and free token claiming for new users.

---

## Tech Stack

- Solidity 0.8.20
- Hardhat 3.x with the Mocha + Ethers toolbox
- Ethers.js (Hardhat runtime + toolbox helpers)
- Frontend: React + Vite + ethers@6.15.0
- OpenZeppelin Contracts 5.4.0
- TypeScript 5.9.3
- ts-node 10.9.2
- @nomicfoundation/hardhat-ethers

---

## Project Structure

```
MyTokenERC20/
│
├── contracts/
│   └── MyTokenERC20.sol         # Main ERC-20 token contract
│
├── scripts/
│   └── deploy.ts                # Deployment script
│
├── test/
│   └── MyTokenERC20.test.ts     # Mocha test suite
│
├── frontend/                    # React + Vite frontend UI (control panel)
│   ├── src/
│   │   ├── App.tsx              # main app, wallet + contract logic
│   │   ├── abi/MyToken.json     # contract ABI used by the frontend
│   │   └── components/          # UI components (Header, Overview, Owner/User forms)
│   └── package.json
│
├── .gitignore                   # Git ignore file
├── hardhat.config.ts            # Hardhat configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started (backend / contract)

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
npx hardhat run scripts/deploy.ts --network localhost
```

After deployment, you will see:

```
MyToken deployed to: 0x...
```

### 4. Run the tests

```bash
npx hardhat test
```

---

## Frontend (React + Vite)

The repository includes a small control panel frontend located in the `frontend/` directory. It uses `ethers@6` to interact with the deployed `MyToken` contract via an injected wallet (MetaMask).

Quick steps to run the frontend locally:

```bash
cd frontend
npm install
# Create a .env file (or set environment variable) with the deployed contract address
# Example .env:
# VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
npm run dev
```

---

## Contract Features

| Function/Flow            | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `claimFreeTokens()`      | Mints a one-time 100-token allocation to the caller                      |
| `setFeeBps(uint256)`     | Sets the transaction fee (in basis points, 100 = 1%)                     |
| `setTreasury(address)`   | Defines the treasury address that receives the fee                       |
| `setMaxTransferAmount(uint256)` | Sets the maximum transfer size (checked only when fees apply)            |
| `pause()` / `unpause()`  | Owner can halt normal transfers                                          |
| `setWhitelisted(address,bool)` | Whitelisted accounts skip pause, fee, and limit checks                   |
| `_update()`              | Overridden ERC20 hook that enforces the custom rules above               |

---

## `_update()` Logic Overview

The `_update()` function executes during every token transfer and applies the following logic:

1.  **Mint/Burn**: Transfers involving the zero address bypass checks.
2.  **Whitelist**: Whitelisted users skip fee and limit checks.
3.  **Pause Check**: Reverts transfers while the contract is paused.
4.  **Fee**: Applies a transaction fee sent to the treasury address.
5.  **Transfer Limit**: Restricts transfers above the defined limit.

---

## Test Suite Overview (`test/MyTokenERC20.test.ts`)

- **Deployment**: Confirms the full initial supply (1,000,000 tokens) is minted to the deployer.
- **Claiming**: Ensures each address can call `claimFreeTokens()` exactly once and emits the mint transfer.
- **Fee Mechanics**: Verifies fees are delivered to the treasury and that the optional max transfer guard works alongside fees.
- **Pause & Whitelist**: Shows that paused transfers revert, while whitelisted addresses can still move tokens.

All tests use the Hardhat 3 toolbox matchers (for example `.to.not.revert(ethers)`) and can be executed with `npx hardhat test`.

---

## Requirements

- Node.js 18 or 20
- npm 8+
