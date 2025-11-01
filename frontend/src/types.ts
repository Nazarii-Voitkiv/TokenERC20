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

export type Toast = {
  type: "success" | "error";
  message: string;
};
