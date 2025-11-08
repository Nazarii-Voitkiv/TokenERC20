export type ContractSnapshot = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: string;
  treasury: string;
  feeBps: number;
  paused: boolean;
  maxTransferAmount: bigint;
  claimAmount: bigint;
};

export type SafeTransaction = {
  id: number;
  to: string;
  value: bigint;
  data: string;
  executed: boolean;
  numConfirmations: number;
  confirmations: string[];
  description: string;
};

export type SafeSnapshot = {
  address: string;
  owners: string[];
  threshold: number;
  transactions: SafeTransaction[];
};

export type Toast = {
  type: "success" | "error";
  message: string;
};

export type AirdropLookupEntry = {
  index: number;
  activityCount: number;
  amount: string;
  proof: string[];
};

export type AirdropDataset = {
  generatedAt: string;
  inputFile?: string;
  rewardPerActivity: string;
  decimals: number;
  minActivity: number;
  merkleRoot: string;
  totals: {
    uniqueAccounts: number;
    totalActivity: number;
    totalAllocated: string;
    totalAllocatedFormatted: string;
  };
  claims: {
    index: number;
    account: string;
    activityCount: number;
    amount: string;
    amountFormatted: string;
    proof: string[];
  }[];
  lookup: Record<string, AirdropLookupEntry>;
};

export type AccountClaim = {
  index: number;
  account: string;
  activityCount: number;
  amount: bigint;
  amountFormatted: string;
  proof: string[];
};

export type AirdropSnapshot = {
  address: string;
  token: string;
  merkleRoot: string;
  balance: bigint;
};
