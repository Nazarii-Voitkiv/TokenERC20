import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  formatUnits,
  getAddress,
  parseUnits,
  solidityPackedKeccak256,
} from "ethers";

type ActivityLogEntry =
  | string
  | number
  | {
      weight?: number;
    };

type ActivityRecord = {
  address: string;
  activityCount?: number;
  count?: number;
  points?: number;
  bonus?: number;
  multiplier?: number;
  activities?: ActivityLogEntry[];
  activityLog?: ActivityLogEntry[];
};

type CLIOptions = {
  inputPath: string;
  outputPath: string;
  rewardPerActivity: string;
  decimals: number;
  minActivity: number;
};

type Claim = {
  index: number;
  account: string;
  activityCount: number;
  amount: bigint;
  leaf: string;
  proof: string[];
};

const ZERO_BYTES32 = `0x${"00".repeat(32)}`;

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: Partial<CLIOptions> = {};

  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    if (!raw.startsWith("--")) continue;

    const [flag, valueFromEquals] = raw.split("=");
    const value = valueFromEquals ?? args[i + 1];
    if (!value) {
      throw new Error(`Missing value for ${flag}`);
    }
    if (!valueFromEquals) i += 1;

    switch (flag) {
      case "--input":
        options.inputPath = value;
        break;
      case "--output":
        options.outputPath = value;
        break;
      case "--reward":
        options.rewardPerActivity = value;
        break;
      case "--decimals":
        options.decimals = Number.parseInt(value, 10);
        break;
      case "--min-activity":
        options.minActivity = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  return {
    inputPath: options.inputPath ?? "data/activities.json",
    outputPath: options.outputPath ?? "airdrop/airdrop-output.json",
    rewardPerActivity: options.rewardPerActivity ?? "10",
    decimals: options.decimals ?? 18,
    minActivity: options.minActivity ?? 1,
  };
}

function normaliseAddress(addr: string): string {
  try {
    return getAddress(addr);
  } catch {
    throw new Error(`Invalid address encountered: ${addr}`);
  }
}

function deriveActivityScore(record: ActivityRecord): number {
  const directFields = [record.activityCount, record.count, record.points]
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : 0))
    .reduce((acc, val) => acc + val, 0);

  const lists: ActivityLogEntry[][] = [];
  if (Array.isArray(record.activities)) lists.push(record.activities);
  if (Array.isArray(record.activityLog)) lists.push(record.activityLog);

  const listScore = lists.reduce<number>((outerAcc, list) => {
    const subtotal = list.reduce<number>((acc, entry) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return acc + entry;
      }
      if (typeof entry === "string") {
        return acc + 1;
      }
      const weight =
        entry && typeof entry === "object" && entry !== null && typeof entry.weight === "number"
          ? entry.weight
          : 1;
      return acc + weight;
    }, 0);
    return outerAcc + subtotal;
  }, 0);

  const multiplier =
    typeof record.multiplier === "number" && Number.isFinite(record.multiplier)
      ? record.multiplier
      : 1;
  const bonus =
    typeof record.bonus === "number" && Number.isFinite(record.bonus)
      ? record.bonus
      : 0;

  return Math.max(0, Math.floor((directFields + listScore) * multiplier + bonus));
}

function hashLeaf(index: number, account: string, amount: bigint): string {
  return solidityPackedKeccak256(
    ["uint256", "address", "uint256"],
    [BigInt(index), account, amount],
  );
}

function hashPair(left: string, right: string): string {
  return solidityPackedKeccak256(["bytes32", "bytes32"], [left, right]);
}

function buildLayers(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[ZERO_BYTES32]];

  const layers: string[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prevLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];
    for (let i = 0; i < prevLayer.length; i += 2) {
      const left = prevLayer[i];
      const right = i + 1 < prevLayer.length ? prevLayer[i + 1] : left;
      nextLayer.push(hashPair(left, right));
    }
    layers.push(nextLayer);
  }
  return layers;
}

function buildProof(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const layer = layers[layerIndex];
    const pairIndex = index ^ 1;
    if (pairIndex < layer.length) {
      proof.push(layer[pairIndex]);
    }
    index = Math.floor(index / 2);
  }
  return proof;
}

function prepareClaims(
  input: ActivityRecord[],
  rewardPerActivityWei: bigint,
  minActivity: number,
): Claim[] {
  const aggregated = new Map<string, number>();

  for (const entry of input) {
    if (!entry || typeof entry.address !== "string") continue;
    const checksum = normaliseAddress(entry.address);
    const score = deriveActivityScore(entry);
    if (score <= 0) continue;
    aggregated.set(checksum, (aggregated.get(checksum) ?? 0) + score);
  }

  const sorted = Array.from(aggregated.entries())
    .filter(([, score]) => score >= minActivity)
    .sort((a, b) => (a[0] > b[0] ? 1 : -1));

  return sorted.map(([account, activityCount], index) => {
    const amount = rewardPerActivityWei * BigInt(activityCount);
    const leaf = hashLeaf(index, account, amount);
    return {
      index,
      account,
      activityCount,
      amount,
      leaf,
      proof: [], // stubbed for now, filled later
    };
  });
}

async function main() {
  const options = parseArgs();
  const inputAbsolute = path.resolve(options.inputPath);
  const outputAbsolute = path.resolve(options.outputPath);

  const raw = await readFile(inputAbsolute, "utf8");
  const parsed = JSON.parse(raw) as ActivityRecord[];
  if (!Array.isArray(parsed)) {
    throw new Error("Input file must contain a JSON array");
  }

  const rewardPerActivityWei = parseUnits(options.rewardPerActivity, options.decimals);
  const claims = prepareClaims(parsed, rewardPerActivityWei, options.minActivity);

  const leaves = claims.map((claim) => claim.leaf);
  const layers = buildLayers(leaves);
  const merkleRoot = layers[layers.length - 1][0] ?? ZERO_BYTES32;

  const claimsWithProofs = claims.map((claim) => ({
    ...claim,
    proof: buildProof(layers, claim.index),
  }));

  const claimsMap = claimsWithProofs.reduce<
    Record<
      string,
      {
        index: number;
        activityCount: number;
        amount: string;
        proof: string[];
      }
    >
  >(
    (acc, claim) => {
      acc[claim.account] = {
        index: claim.index,
        activityCount: claim.activityCount,
        amount: claim.amount.toString(),
        proof: claim.proof,
      };
      return acc;
    },
    {},
  );

  const totalActivity = claimsWithProofs.reduce((acc, claim) => acc + claim.activityCount, 0);
  const totalAllocated = claimsWithProofs.reduce((acc, claim) => acc + claim.amount, 0n);

  const outputPayload = {
    generatedAt: new Date().toISOString(),
    inputFile: inputAbsolute,
    rewardPerActivity: options.rewardPerActivity,
    decimals: options.decimals,
    minActivity: options.minActivity,
    merkleRoot,
    totals: {
      uniqueAccounts: claimsWithProofs.length,
      totalActivity,
      totalAllocated: totalAllocated.toString(),
      totalAllocatedFormatted: formatUnits(totalAllocated, options.decimals),
    },
    claims: claimsWithProofs.map((claim) => ({
      index: claim.index,
      account: claim.account,
      activityCount: claim.activityCount,
      amount: claim.amount.toString(),
      amountFormatted: formatUnits(claim.amount, options.decimals),
      proof: claim.proof,
    })),
    lookup: claimsMap,
  };

  await mkdir(path.dirname(outputAbsolute), { recursive: true });
  await writeFile(outputAbsolute, JSON.stringify(outputPayload, null, 2));

  console.log("Merkle root:", merkleRoot);
  console.log("Unique recipients:", claimsWithProofs.length);
  console.log("Total activity score:", totalActivity);
  console.log(
    "Total allocated:",
    formatUnits(totalAllocated, options.decimals),
    `(raw ${totalAllocated})`,
  );
  console.log("Output written to:", outputAbsolute);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
