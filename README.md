# MyToken Control Center

End‑to‑end stack for an ERC‑20 with a faucet, a multisig owner, and a Merkle airdrop distributor. Includes Hardhat (deploy/verify), Foundry tests, data pipelines for building Merkle trees, and a Vite + React UI.

---

## Prerequisites

- Node.js 18/20 + npm 8+
- Hardhat toolchain (`npx hardhat test` works out of the box)
- Foundry (`forge test`)
- A JSON‑RPC endpoint for the target network (Hardhat node, Goerli, mainnet, etc.)

Install dependencies once:

```bash
npm install
cd frontend && npm install
```

---

## Configuration

### Root `.env`

Copy `.env.example` → `.env` and fill:

| Variable | Meaning |
| --- | --- |
| `TOKEN_NAME`, `TOKEN_SYMBOL` | ERC‑20 metadata |
| `TOKEN_INITIAL_SUPPLY` | Whole tokens minted to deployer before ownership transfer |
| `TOKEN_CLAIM_AMOUNT` | Faucet amount minted per wallet |
| `AIRDROP_MERKLE_ROOT` | Merkle root for the distributor (from `generateAirdrop.ts`) |
| `AIRDROP_RESERVE` | Whole tokens to transfer into the distributor immediately after deploy |
| `MULTISIG_OWNERS` | Comma‑separated owner addresses |
| `MULTISIG_THRESHOLD` | Required confirmations |

### Frontend `.env`

Inside `frontend/` create `.env` with:

| Variable | Meaning |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | MyToken address |
| `VITE_SAFE_ADDRESS` | MyTokenSafe address |
| `VITE_AIRDROP_ADDRESS` | MerkleAirdrop address |
| `VITE_AIRDROP_DATA_URL` | Public URL (or `/airdrop/latest.json`) pointing to the Merkle JSON |

---

## Deploy flow

1. **Gather activity data (optional but recommended)**  
   - Open `scripts/collectActivity.ts` and edit the `CONFIG` block (token address, RPC URL, block range, chunk size).  
   - Run:
     ```bash
     npx ts-node --esm scripts/collectActivity.ts
     ```
     Output: `data/activity-from-chain.json`.
2. **Build the Merkle tree**  
   ```bash
   npx ts-node --esm scripts/generateAirdrop.ts \
     --input data/activity-from-chain.json \
     --reward 25 \
     --decimals 18 \
     --min-activity 1 \
     --output frontend/airdrop/epoch-1.json
   ```
   Note the printed Merkle root and totals. Update `AIRDROP_MERKLE_ROOT` in `.env` and copy the JSON to a public location consumed by the frontend (`frontend/public/airdrop/latest.json` is convenient).
3. **Start a network (if local)**  
   ```bash
   npx hardhat node
   ```
4. **Deploy contracts**  
   ```bash
   npx hardhat run scripts/deploy.ts --network <network>
   ```
   The script deploys `MyToken`, `MyTokenSafe`, `MerkleAirdrop`, transfers token ownership to the safe, and optionally seeds the airdrop with `AIRDROP_RESERVE`.
5. **Verify (optional)**  
   Set `ETHERSCAN_API_KEY` and run:
   ```bash
   npx hardhat verify --network <network> \
     <contractAddress> <constructorArgs...>
   ```
   Repeat for MyToken, MyTokenSafe, MerkleAirdrop.
6. **Expose data to the frontend**  
   - Update `frontend/.env` with the deployed addresses and the JSON URL.
   - Build or run the UI:
     ```bash
     cd frontend
     npm run dev        # local dev server
     npm run build      # production bundle
     ```
7. **(Optional) Update Merkle roots on-chain**  
   Use the dashboard (Multisig tab) or call `setMerkleRoot` via the safe to rotate epochs. Fund the airdrop contract with the total allocated amount for the new epoch.

---

## Scripts summary

| Script | Description |
| --- | --- |
| `scripts/deploy.ts` | Deploy MyToken, MyTokenSafe, MerkleAirdrop, transfer ownership, seed distributor |
| `scripts/collectActivity.ts` | Scan on-chain `Transfer` events, aggregate activity, emit JSON for the next step |
| `scripts/generateAirdrop.ts` | Transform activity JSON into Merkle tree artifacts (claims, lookup, root, totals) |

---

## Running tests

```bash
npx hardhat test           # TypeScript specs
forge test                 # Solidity specs
```

---

## Frontend overview

`frontend/` is a Vite + React dashboard with a global sidebar:

- **Overview** – token stats, multisig status, connected wallet role.
- **User Actions** – faucet claim, transfers, burns.
- **Merkle Airdrop** – proof lookup, root validation, claim button.
- **Multisig Controls** – pause, fees, treasury, limits, whitelist, plus Merkle root updates via the safe.

The UI fetches the Merkle JSON from `VITE_AIRDROP_DATA_URL`, compares its root with the on-chain value, and displays remaining/claimed allocations in real time.
