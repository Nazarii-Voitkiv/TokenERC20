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
