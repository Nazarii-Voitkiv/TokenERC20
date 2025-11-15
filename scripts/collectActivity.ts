import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Interface, JsonRpcProvider, formatUnits, getAddress, id } from "ethers";

type ActivitySnapshot = {
  address: string;
  sentCount: number;
  receivedCount: number;
  sentVolume: bigint;
  receivedVolume: bigint;
  counterparties: Set<string>;
};

type ActivityRecord = {
  address: string;
  activityCount: number;
  activities: Array<{ weight: number }>;
  bonus?: number;
};

const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const ERC20_INTERFACE = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

const CONFIG = {
  token: getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3"), // MyToken on Hardhat (adjust if needed)
  rpcUrl: "http://127.0.0.1:8545",
  fromBlock: 0,
  toBlock: undefined as number | undefined,
  chunkSize: 2_000,
  minValue: 0n,
  decimals: 18,
  output: "data/activity-from-chain.json",
};

function chunkRange(start: number, end: number, chunkSize: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let cursor = start; cursor <= end; cursor += chunkSize + 1) {
    const chunkEnd = Math.min(end, cursor + chunkSize);
    ranges.push([cursor, chunkEnd]);
  }
  return ranges;
}

async function main() {
    if (!CONFIG.token || !CONFIG.rpcUrl) {
    throw new Error("Configure token address and RPC URL inside scripts/collectActivity.ts");
  }
  const provider = new JsonRpcProvider(CONFIG.rpcUrl);
  const latestBlock = CONFIG.toBlock ?? (await provider.getBlockNumber());
    if (latestBlock < CONFIG.fromBlock) {
    throw new Error("toBlock must be greater than fromBlock");
  }

  const activity = new Map<string, ActivitySnapshot>();
  const ranges = chunkRange(CONFIG.fromBlock, latestBlock, CONFIG.chunkSize);
  console.log(
    `Scanning Transfer logs for ${CONFIG.token} from block ${CONFIG.fromBlock} to ${latestBlock} in ${ranges.length} chunk(s)...`,
  );

  for (const [fromBlock, toBlock] of ranges) {
    const logs = await provider.getLogs({
      address: CONFIG.token,
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
      if (value < CONFIG.minValue) continue;

      const fromSnapshot =
        activity.get(from) ??
        {
          address: from,
          sentCount: 0,
          receivedCount: 0,
          sentVolume: 0n,
          receivedVolume: 0n,
          counterparties: new Set<string>(),
        };
      fromSnapshot.sentCount += 1;
      fromSnapshot.sentVolume += value;
      fromSnapshot.counterparties.add(to);
      activity.set(from, fromSnapshot);

      const toSnapshot =
        activity.get(to) ??
        {
          address: to,
          sentCount: 0,
          receivedCount: 0,
          sentVolume: 0n,
          receivedVolume: 0n,
          counterparties: new Set<string>(),
        };
      toSnapshot.receivedCount += 1;
      toSnapshot.receivedVolume += value;
      toSnapshot.counterparties.add(from);
      activity.set(to, toSnapshot);
    }
  }

  const records: ActivityRecord[] = Array.from(activity.values())
    .map((snapshot) => {
      const counterparties = snapshot.counterparties.size;
      const activityCount = snapshot.sentCount + snapshot.receivedCount + Math.min(counterparties, 5);
      const activities: Array<{ weight: number }> = [];
      if (snapshot.sentCount > 0) {
        activities.push({ weight: snapshot.sentCount });
      }
      if (snapshot.receivedCount > 0) {
        activities.push({ weight: snapshot.receivedCount * 0.8 });
      }
      if (counterparties > 0) {
        activities.push({ weight: counterparties });
      }

      const bonus =
        snapshot.sentVolume >= CONFIG.bonusThreshold
          ? Number(formatUnits(snapshot.sentVolume / 10n, CONFIG.decimals))
          : undefined;

      return {
        address: snapshot.address,
        activityCount,
        activities,
        ...(bonus ? { bonus } : {}),
      } as ActivityRecord;
    })
    .filter((record) => record.activityCount > 0)
    .sort((a, b) => (a.address > b.address ? 1 : -1));

  const outputAbsolute = path.resolve(CONFIG.output);
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
  console.log(`Aggregate sent volume: ${formatUnits(totalVolume, CONFIG.decimals)}`);
  console.log(`Activity JSON written to: ${outputAbsolute}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
