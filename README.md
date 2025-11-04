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
- `VITE_CONTRACT_ADDRESS`, `VITE_SAFE_ADDRESS` (set after deploy; required by the frontend)

### Deploy to localhost

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

The script:
1. Deploys `MyToken` with the configured metadata and supply.
2. Deploys `MyTokenSafe` with your owners and threshold.
3. Transfers token ownership to the multisig.

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

## Requirements

- Node.js 18 or 20
- npm 8+
- (for Foundry) `forge`
