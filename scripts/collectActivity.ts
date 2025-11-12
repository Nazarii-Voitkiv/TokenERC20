import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Interface, JsonRpcProvider, formatUnits, getAddress, id } from "ethers";

type CLIOptions = {
  token: string;
  rpcUrl: string;
  fromBlock: number;
  toBlock?: number;
  chunkSize: number;
  minValue: bigint;
  output: string;
  decimals: number;
};

type ActivitySnapshot = {
  address: string;
  sentCount: number;
  receivedCount: number;
  sentVolume: bigint;
  receivedVolume: bigint;
};

type ActivityRecord = {
  address: string;
  activityCount: number;
  activities: Array<{ type: "sent" | "received"; count: number; volume: string }>;
};

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const ERC20_INTERFACE = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

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
      case "--token":
        options.token = value;
        break;
      case "--rpc":
        options.rpcUrl = value;
        break;
      case "--from":
        options.fromBlock = Number.parseInt(value, 10);
        break;
      case "--to":
        options.toBlock = Number.parseInt(value, 10);
        break;
      case "--chunk":
        options.chunkSize = Number.parseInt(value, 10);
        break;
      case "--min-value":
        options.minValue = BigInt(value);
        break;
      case "--decimals":
        options.decimals = Number.parseInt(value, 10);
        break;
      case "--output":
        options.output = value;
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  if (!options.token) throw new Error("Provide --token=<erc20-address>");
  if (!options.rpcUrl) throw new Error("Provide --rpc=<RPC URL>");
  if (!options.fromBlock || Number.isNaN(options.fromBlock)) {
    throw new Error("Provide --from=<start block>");
  }

  return {
    token: getAddress(options.token),
    rpcUrl: options.rpcUrl,
    fromBlock: options.fromBlock,
    toBlock: options.toBlock,
    chunkSize: options.chunkSize && options.chunkSize > 0 ? options.chunkSize : 2_000,
    minValue: options.minValue ?? 0n,
    output: options.output ?? "data/activity-from-chain.json",
    decimals: options.decimals ?? 18,
  };
}

function chunkRange(start: number, end: number, chunkSize: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let cursor = start; cursor <= end; cursor += chunkSize + 1) {
    const chunkEnd = Math.min(end, cursor + chunkSize);
    ranges.push([cursor, chunkEnd]);
  }
  return ranges;
}

async function main() {
  const options = parseArgs();
  const provider = new JsonRpcProvider(options.rpcUrl);
  const latestBlock = options.toBlock ?? (await provider.getBlockNumber());
  if (latestBlock < options.fromBlock) {
    throw new Error("toBlock must be greater than fromBlock");
  }

  const activity = new Map<string, ActivitySnapshot>();
  const ranges = chunkRange(options.fromBlock, latestBlock, options.chunkSize);
  console.log(
    `Scanning Transfer logs for ${options.token} from block ${options.fromBlock} to ${latestBlock} in ${ranges.length} chunk(s)...`,
  );

  for (const [fromBlock, toBlock] of ranges) {
    const logs = await provider.getLogs({
      address: options.token,
      topics: [TRANSFER_TOPIC],
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const parsed = ERC20_INTERFACE.parseLog(log);
      if (!parsed) continue;
      const from = getAddress(parsed.args.from);
      const to = getAddress(parsed.args.to);
      const value = BigInt(parsed.args.value);
      if (value < options.minValue) continue;

      const fromSnapshot =
        activity.get(from) ??
        {
          address: from,
          sentCount: 0,
          receivedCount: 0,
          sentVolume: 0n,
          receivedVolume: 0n,
        };
      fromSnapshot.sentCount += 1;
      fromSnapshot.sentVolume += value;
      activity.set(from, fromSnapshot);

      const toSnapshot =
        activity.get(to) ??
        {
          address: to,
          sentCount: 0,
          receivedCount: 0,
          sentVolume: 0n,
          receivedVolume: 0n,
        };
      toSnapshot.receivedCount += 1;
      toSnapshot.receivedVolume += value;
      activity.set(to, toSnapshot);
    }
  }

  const records: ActivityRecord[] = Array.from(activity.values())
    .map((snapshot) => {
      const activities = [];
      if (snapshot.sentCount > 0) {
        activities.push({
          type: "sent",
          count: snapshot.sentCount,
          volume: snapshot.sentVolume.toString(),
        });
      }
      if (snapshot.receivedCount > 0) {
        activities.push({
          type: "received",
          count: snapshot.receivedCount,
          volume: snapshot.receivedVolume.toString(),
        });
      }
      const activityCount = snapshot.sentCount + snapshot.receivedCount;
      return {
        address: snapshot.address,
        activityCount,
        activities,
      };
    })
    .filter((record) => record.activityCount > 0)
    .sort((a, b) => (a.address > b.address ? 1 : -1));

  const outputAbsolute = path.resolve(options.output);
  await writeFile(outputAbsolute, JSON.stringify(records, null, 2));

  const totalTransfers = records.reduce((acc, record) => acc + record.activityCount, 0);
  const uniqueAddresses = records.length;
  const totalVolume = records.reduce(
    (acc, record) =>
      acc +
      record.activities.reduce((innerAcc, entry) => {
        if (entry.type === "sent") {
          return innerAcc + BigInt(entry.volume);
        }
        return innerAcc;
      }, 0n),
    0n,
  );

  console.log(`Unique addresses: ${uniqueAddresses}`);
  console.log(`Total transfer events counted (sent + received): ${totalTransfers}`);
  console.log(`Aggregate sent volume: ${formatUnits(totalVolume, options.decimals)}`);
  console.log(`Activity JSON written to: ${outputAbsolute}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
