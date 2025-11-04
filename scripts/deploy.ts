import hre from "hardhat";

const DEFAULT_INITIAL_SUPPLY = 1_000_000n;
const DEFAULT_CLAIM_AMOUNT = 100n;

function parseOwners(rawOwners: string | undefined) {
  if (!rawOwners) return [];

  return rawOwners
    .split(",")
    .map((owner) => owner.trim())
    .filter((owner) => owner.length > 0);
}

function parseThreshold(rawThreshold: string | undefined, ownerCount: number) {
  if (!rawThreshold) return Math.min(2, ownerCount);

  const threshold = Number.parseInt(rawThreshold, 10);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > ownerCount) {
    throw new Error(
      `Invalid MULTISIG_THRESHOLD=${rawThreshold}. Expected integer between 1 and ${ownerCount}.`,
    );
  }
  return threshold;
}

function parseUint(rawValue: string | undefined, fallback: bigint, label: string) {
  if (!rawValue) return fallback;

  try {
    const value = BigInt(rawValue);
    if (value <= 0n) throw new Error();
    return value;
  } catch {
    throw new Error(`Invalid ${label}=${rawValue}. Expected a positive integer.`);
  }
}

async function main() {
  const { ethers } = await hre.network.connect();
  const [deployer, ...otherSigners] = await ethers.getSigners();
  const providedOwners = parseOwners(process.env.MULTISIG_OWNERS);

  let owners: string[];
  if (providedOwners.length > 0) {
    owners = providedOwners;
  } else {
    if (otherSigners.length < 2) {
      throw new Error(
        "Hardhat network has fewer than 3 signers. Provide MULTISIG_OWNERS explicitly to continue.",
      );
    }
    owners = [deployer.address, otherSigners[0].address, otherSigners[1].address];
  }

  owners = Array.from(new Set(owners));

  if (owners.length === 0) {
    throw new Error(
      "No multisig owners provided. Define MULTISIG_OWNERS env var or ensure Hardhat exposes enough signers.",
    );
  }

  const threshold = parseThreshold(process.env.MULTISIG_THRESHOLD, owners.length);
  const initialSupplyWhole = parseUint(
    process.env.TOKEN_INITIAL_SUPPLY,
    DEFAULT_INITIAL_SUPPLY,
    "TOKEN_INITIAL_SUPPLY",
  );
  const claimAmountWhole = parseUint(
    process.env.TOKEN_CLAIM_AMOUNT,
    DEFAULT_CLAIM_AMOUNT,
    "TOKEN_CLAIM_AMOUNT",
  );

  const tokenName = process.env.TOKEN_NAME ?? "MyToken";
  const tokenSymbol = process.env.TOKEN_SYMBOL ?? "MTK";

  console.log("Deploying contracts with deployer:", deployer.address);
  console.log("Multisig owners:", owners);
  console.log("Threshold:", threshold);

  const token = await ethers.deployContract("MyToken", [
    tokenName,
    tokenSymbol,
    initialSupplyWhole,
    claimAmountWhole,
  ]);
  await token.waitForDeployment();

  const safe = await ethers.deployContract("MyTokenSafe", [owners, threshold]);
  await safe.waitForDeployment();

  const safeAddress = await safe.getAddress();

  const ownershipTx = await token.transferOwnership(safeAddress);
  await ownershipTx.wait();

  console.log("MyToken deployed to:", await token.getAddress());
  console.log("MyTokenSafe deployed to:", safeAddress);
  console.log("Ownership of MyToken transferred to MyTokenSafe multisig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
