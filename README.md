# MyTokenERC20

## At a Glance

- `MyToken`: ERC‑20 with transfer fees, optional limits, pause switch, and a faucet for newcomers.
- `MyTokenSafe`: multisig owner of the token, enforcing quorum for every privileged action.
- React/Vite dashboard to monitor state and steer multisig proposals.
- Dual test suites: Hardhat (TypeScript) and Foundry (Solidity).

---

## Quick Start

```bash
npm install
npx hardhat node
```

Copy `.env.example` ➜ `.env` and fill in:

- `TOKEN_NAME`, `TOKEN_SYMBOL`, `TOKEN_INITIAL_SUPPLY`, `TOKEN_CLAIM_AMOUNT`
- `MULTISIG_OWNERS` (comma-separated addresses), `MULTISIG_THRESHOLD`
- `AIRDROP_MERKLE_ROOT`, `AIRDROP_RESERVE` (optional, but needed if you want the script to seed the distributor)
- `VITE_CONTRACT_ADDRESS`, `VITE_SAFE_ADDRESS`, `VITE_AIRDROP_ADDRESS`, `VITE_AIRDROP_DATA_URL` (set after deploy; required by the frontend)

### Deploy to localhost

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

The script:
1. Deploys `MyToken` with the configured metadata and supply.
2. Deploys `MyTokenSafe` with your owners and threshold.
3. Transfers token ownership to the multisig.
4. Deploys `MerkleAirdrop` (owned by the multisig), seeds it with `AIRDROP_RESERVE`, and prints the Merkle root so you can match it with the JSON artifact.

---

## Frontend

```bash
cd frontend
npm install
cp ../.env.example .env    # or add the variables manually
npm run dev
```

The UI lets you:
- submit proposals (pause, fees, whitelist, limit, treasury updates);
- confirm or revoke your approvals;
- execute once quorum is hit;
- inspect owners, threshold, balances, and token settings.

---

## Testing

```bash
npx hardhat test   # TypeScript specs for the token and the multisig
forge test         # Solidity specs (Foundry)
```

- Hardhat covers ERC‑20 behavior (`test/MyTokenERC20.test.ts`) and multisig flows (`test/MyTokenSafe.test.ts`).
- Foundry reuses the same contracts; configuration lives in `foundry.toml`, tests in `foundry/test/`.
- Before running Foundry, install `forge` (`foundryup`) and ensure `npm install` has fetched OpenZeppelin.

---

## Key Capabilities

| Function | Description |
| --- | --- |
| `claimFreeTokens()` | One-time faucet mint |
| `setFeeBps(uint256)` | Adjust transfer fee (in bps) |
| `setTreasury(address)` | Point fees to a treasury address |
| `setMaxTransferAmount(uint256)` | Cap transfer size (enforced alongside fees) |
| `setWhitelisted(address[],bool)` | Whitelist accounts from fees/pause/limit |
| `pause()` / `unpause()` | Global pause switch |
| `MyTokenSafe.submit/confirm/execute` | Full multisig transaction lifecycle |

---

## Merkle Airdrop Flow

### Contract

- `MerkleAirdrop` escrows `MyToken` and exposes a `claim(index, account, amount, proof)` entrypoint secured by a Merkle root.
- Claimed indices are tracked through a bitmap to prevent double spends.
- Owner abilities: update the root (`setMerkleRoot`) and recover/fund tokens (`recover(address,uint256)`).
- Deploy with `(tokenAddress, initialRoot, owner)`, send the allocation to the contract, and hand the root to frontends/users.

### Generating the tree

1. Prepare a JSON array describing user activity. A sample lives in `data/sample-activities.json`.
2. Run the helper to score addresses, compute payouts, and emit the Merkle data set:

```bash
npx ts-node --esm scripts/generateAirdrop.ts \
  --input data/sample-activities.json \
  --reward 25 \
  --decimals 18 \
  --min-activity 1 \
  --output airdrop/epoch-1.json
```

| Field | Meaning |
| --- | --- |
| `activityCount` / `count` / `points` | Direct numeric score |
| `activities`, `activityLog` | Arrays of strings/numbers/objects (`{ "weight": number }`) summed into the score |
| `multiplier` | Multiplies the derived score (default `1`) |
| `bonus` | Flat offset applied at the end |

The script prints the Merkle root and allocation summary, then writes:

- `claims[]`: ordered tuples with `index`, `account`, `activityCount`, `amount`, and `proof`.
- `lookup`: address ➜ claim snippet (handy for a frontend or CLI).
- `totals` & metadata so you can reproduce/verify airdrop epochs.

Copy the JSON to somewhere the frontend can reach (e.g. `frontend/public/airdrop/latest.json`) and set `VITE_AIRDROP_DATA_URL` accordingly. After deploying the distributor, set `VITE_AIRDROP_ADDRESS` so the UI knows which contract to call.

3. Feed the reported `merkleRoot` into the contract constructor or `setMerkleRoot`.
4. Once funded, users call `claim` with their tuple and proof from the JSON output to withdraw tokens.

The dashboard automatically fetches the JSON (via `VITE_AIRDROP_DATA_URL`), compares its root with the on-chain value, and enables a “Claim Merkle Airdrop” button when the connected wallet has a record.

---

## Requirements

- Node.js 18 or 20
- npm 8+
- (for Foundry) `forge`
