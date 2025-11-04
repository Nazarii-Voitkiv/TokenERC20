import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import MyToken from "./abi/MyToken.json";
import MyTokenSafe from "./abi/MyTokenSafe.json";
import { Header } from "./components/Header/Header";
import { OverviewCard } from "./components/Overview/OverviewCard";
import { UserActions } from "./components/UserActions/UserActions";
import { OwnerControls } from "./components/OwnerControls/OwnerControls";
import { Toast as ToastBanner } from "./components/Toast/Toast";
import styles from "./App.module.css";
import type { ContractSnapshot, SafeSnapshot, Toast } from "./types";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
const SAFE_ADDRESS = import.meta.env.VITE_SAFE_ADDRESS as string | undefined;
const ZERO_ADDRESS = ethers.ZeroAddress;

function App() {
  const [account, setAccount] = useState<string>("");
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
  const [safeSnapshot, setSafeSnapshot] = useState<SafeSnapshot | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [hasClaimed, setHasClaimed] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [transferForm, setTransferForm] = useState({ to: "", amount: "" });
  const [burnAmount, setBurnAmount] = useState<string>("");
  const [treasuryInput, setTreasuryInput] = useState<string>("");
  const [feeInput, setFeeInput] = useState<string>("");
  const [maxTransferInput, setMaxTransferInput] = useState<string>("");
  const [whitelistForm, setWhitelistForm] = useState({ address: "", allowed: true });

  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const tokenMetaRef = useRef({ decimals: 18, symbol: "TOKEN" });

  const tokenInterface = useMemo(() => new ethers.Interface(MyToken.abi), []);
  const safeInterface = useMemo(() => new ethers.Interface(MyTokenSafe.abi), []);

  const setAlert = useCallback((type: Toast["type"], message: string) => {
    setToast({ type, message });
  }, []);

  const handleTransferFormChange = useCallback((field: "to" | "amount", value: string) => {
    setTransferForm((prev) => ({
      ...prev,
      [field]: field === "to" ? value : value.replace(",", "."),
    }));
  }, []);

  const handleBurnInputChange = useCallback((value: string) => {
    setBurnAmount(value);
  }, []);

  const handleTreasuryInputChange = useCallback((value: string) => {
    setTreasuryInput(value);
  }, []);

  const handleFeeInputChange = useCallback((value: string) => {
    setFeeInput(value);
  }, []);

  const handleMaxTransferInputChange = useCallback((value: string) => {
    setMaxTransferInput(value);
  }, []);

  const handleWhitelistAddressChange = useCallback((value: string) => {
    setWhitelistForm((prev) => ({ ...prev, address: value }));
  }, []);

  const handleWhitelistAllowedChange = useCallback((value: boolean) => {
    setWhitelistForm((prev) => ({ ...prev, allowed: value }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const getProvider = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }
    if (!providerRef.current) {
      providerRef.current = new ethers.BrowserProvider(window.ethereum);
    }
    return providerRef.current;
  }, []);

  const getReadContract = useCallback(async () => {
    const provider = await getProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, MyToken.abi, provider);
  }, [getProvider]);

  const getWriteContract = useCallback(async () => {
    const provider = await getProvider();
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, MyToken.abi, signer);
  }, [getProvider]);

  const getReadSafeContract = useCallback(async () => {
    if (!SAFE_ADDRESS || !ethers.isAddress(SAFE_ADDRESS)) {
      throw new Error("VITE_SAFE_ADDRESS must be configured in the frontend .env");
    }
    const provider = await getProvider();
    return new ethers.Contract(SAFE_ADDRESS, MyTokenSafe.abi, provider);
  }, [getProvider]);

  const getWriteSafeContract = useCallback(async () => {
    if (!SAFE_ADDRESS || !ethers.isAddress(SAFE_ADDRESS)) {
      throw new Error("VITE_SAFE_ADDRESS must be configured in the frontend .env");
    }
    const provider = await getProvider();
    const signer = await provider.getSigner();
    return new ethers.Contract(SAFE_ADDRESS, MyTokenSafe.abi, signer);
  }, [getProvider]);

  const describeSafeTransaction = useCallback(
    (to: string, data: string, value: bigint) => {
      const lowerTo = to.toLowerCase();
      const tokenLower = CONTRACT_ADDRESS.toLowerCase();
      const safeLower = SAFE_ADDRESS ? SAFE_ADDRESS.toLowerCase() : "";
      const { decimals, symbol } = tokenMetaRef.current;
      const valueSuffix =
        value > 0n ? ` (+${ethers.formatEther(value)} ETH transfer)` : "";

      if (!data || data === "0x") {
        if (value > 0n) {
          return `Send ${ethers.formatEther(value)} ETH to ${to}`;
        }
        return `Call ${to} with no calldata`;
      }

      if (lowerTo === tokenLower) {
        try {
          const parsed = tokenInterface.parseTransaction({ data });
          if (!parsed) {
            throw new Error("Unable to decode token calldata");
          }
          switch (parsed.name) {
            case "pause":
              return `Pause token${valueSuffix}`;
            case "unpause":
              return `Unpause token${valueSuffix}`;
            case "setTreasury":
              return `Set treasury to ${parsed.args[0]}${valueSuffix}`;
            case "setFeeBps":
              return `Set fee to ${parsed.args[0]} bps${valueSuffix}`;
            case "setMaxTransferAmount": {
              const raw = parsed.args[0] as bigint;
              const formatted =
                raw === 0n
                  ? "unlimited"
                  : `${ethers.formatUnits(raw, decimals)} ${symbol}`;
              return `Set max transfer to ${formatted}${valueSuffix}`;
            }
            case "setWhitelisted": {
              const addresses = (parsed.args[0] as string[]) ?? [];
              const allowed = Boolean(parsed.args[1]);
              if (addresses.length === 1) {
                return `${allowed ? "Whitelist" : "Remove"} ${addresses[0]}${valueSuffix}`;
              }
              return `${allowed ? "Whitelist" : "Remove"} ${addresses.length} addresses${valueSuffix}`;
            }
            default:
              return `Call token.${parsed.name}()${valueSuffix}`;
          }
        } catch {
          // fallthrough to generic path
        }
      }

      if (SAFE_ADDRESS && lowerTo === safeLower) {
        try {
          const parsed = safeInterface.parseTransaction({ data });
          if (!parsed) {
            throw new Error("Unable to decode safe calldata");
          }
          switch (parsed.name) {
            case "addOwner":
              return `Add multisig owner ${parsed.args[0]}${valueSuffix}`;
            case "removeOwner":
              return `Remove multisig owner ${parsed.args[0]}${valueSuffix}`;
            case "changeThreshold":
              return `Change threshold to ${parsed.args[0]}${valueSuffix}`;
            default:
              return `Call multisig.${parsed.name}()${valueSuffix}`;
          }
        } catch {
          // ignore and use generic fallback
        }
      }

      const selector = data.slice(0, 10);
      return `Call ${to} (${selector})${valueSuffix}`;
    },
    [safeInterface, tokenInterface]
  );

  const fetchSafeSnapshot = useCallback(async () => {
    if (!SAFE_ADDRESS || !ethers.isAddress(SAFE_ADDRESS)) {
      setSafeSnapshot(null);
      return null;
    }

    try {
      const safeContract = await getReadSafeContract();
      const [owners, thresholdRaw, countRaw] = await Promise.all([
        safeContract.getOwners(),
        safeContract.threshold(),
        safeContract.getTransactionCount(),
      ]);

      const threshold = Number(thresholdRaw);
      const txCount = Number(countRaw);
      const txIds = Array.from({ length: txCount }, (_, index) => index);

      const transactions = await Promise.all(
        txIds.map(async (txId) => {
          const tx = await safeContract.getTransaction(txId);
          const to: string = tx[0];
          const valueRaw: bigint = tx[1];
          const data: string = tx[2];
          const executed: boolean = tx[3];
          const numConfirmationsRaw: bigint = tx[4];

          const confirmations = await Promise.all(
            owners.map(async (owner: string) => {
              const confirmed = await safeContract.isConfirmed(txId, owner);
              return confirmed ? owner : null;
            })
          );

          return {
            id: txId,
            to,
            value: valueRaw,
            data,
            executed,
            numConfirmations: Number(numConfirmationsRaw),
            confirmations: confirmations.filter(Boolean) as string[],
            description: describeSafeTransaction(to, data, valueRaw),
          };
        })
      );

      const snapshot: SafeSnapshot = {
        address: SAFE_ADDRESS,
        owners,
        threshold,
        transactions,
      };

      setSafeSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      console.error(error);
      setSafeSnapshot(null);
      return null;
    }
  }, [describeSafeTransaction, getReadSafeContract]);

  const fetchContractSnapshot = useCallback(async () => {
    try {
      const contract = await getReadContract();
      const [
        name,
        symbol,
        decimalsRaw,
        totalSupply,
        ownerAddress,
        treasuryAddress,
        feeBpsRaw,
        paused,
        maxTransfer,
        claimAmount,
      ] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
        contract.owner(),
        contract.treasury(),
        contract.feeBps(),
        contract.paused(),
        contract.maxTransferAmount(),
        contract.CLAIM_AMOUNT(),
      ]);

      const decimals = Number(decimalsRaw);
      const feeBps = Number(feeBpsRaw);

      tokenMetaRef.current = { decimals, symbol };

      setSnapshot({
        name,
        symbol,
        decimals,
        totalSupply,
        owner: ownerAddress,
        treasury: treasuryAddress,
        feeBps,
        paused: Boolean(paused),
        maxTransferAmount: maxTransfer,
        claimAmount,
      });

      setTreasuryInput(treasuryAddress === ZERO_ADDRESS ? "" : treasuryAddress);
      setFeeInput(feeBps.toString());
      setMaxTransferInput(maxTransfer === 0n ? "" : ethers.formatUnits(maxTransfer, decimals));
      await fetchSafeSnapshot();
    } catch (error) {
      console.error(error);
    }
  }, [fetchSafeSnapshot, getReadContract]);

  const fetchAccountState = useCallback(
    async (addr?: string) => {
      try {
        const target = addr ?? account;
        if (!target) return;
        const contract = await getReadContract();
        const [bal, claimed] = await Promise.all([
          contract.balanceOf(target),
          contract.hasClaimed(target),
        ]);
        setBalance(bal);
        setHasClaimed(Boolean(claimed));
      } catch (error) {
        console.error(error);
      }
    },
    [account, getReadContract]
  );

  const resetConnectionState = useCallback(() => {
    setAccount("");
    setBalance(0n);
    setHasClaimed(false);
    providerRef.current = null;
  }, []);

  const localDisconnect = useCallback(() => {
    resetConnectionState();
  }, [resetConnectionState]);

  const connectWallet = useCallback(async () => {
    try {
      const provider = await getProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      const addr = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!addr) {
        throw new Error("Wallet connection failed");
      }
      setAccount(addr);
      await Promise.all([fetchContractSnapshot(), fetchAccountState(addr)]);
      setAlert("success", "Wallet connected");
    } catch (error) {
      console.error(error);
      setAlert("error", "Cannot connect wallet");
    }
  }, [fetchAccountState, fetchContractSnapshot, getProvider, setAlert]);

  const disconnect = useCallback(async () => {
    localDisconnect();
    if (window.ethereum?.request) {
      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (err) {
        console.warn("wallet_requestPermissions failed", err);
      }
    }
  }, [localDisconnect]);

  const transferValidation = useMemo(() => {
    if (!snapshot) {
      return { disabled: true, reason: "Contract data not loaded yet." };
    }
    const recipient = transferForm.to.trim();
    if (!recipient) {
      return { disabled: true, reason: "Enter recipient address." };
    }
    if (!ethers.isAddress(recipient)) {
      return { disabled: true, reason: "Recipient address is invalid." };
    }
    const rawAmount = transferForm.amount.trim();
    if (!rawAmount) {
      return { disabled: true, reason: "Enter transfer amount." };
    }
    let parsedAmount: bigint;
    try {
      parsedAmount = ethers.parseUnits(rawAmount, snapshot.decimals);
    } catch {
      return { disabled: true, reason: "Amount has invalid format." };
    }
    if (parsedAmount <= 0n) {
      return { disabled: true, reason: "Amount must be greater than zero." };
    }
    if (parsedAmount > balance) {
      return { disabled: true, reason: "Insufficient balance for this transfer." };
    }
    const ownerAddress = snapshot.owner?.toLowerCase?.();
    const isOwnerAccount =
      !!ownerAddress && !!account && account.toLowerCase() === ownerAddress;
    if (snapshot.paused && !isOwnerAccount) {
      return { disabled: true, reason: "Token is paused." };
    }
    return { disabled: false, reason: "" };
  }, [account, balance, snapshot, transferForm.amount, transferForm.to]);

  const burnValidation = useMemo(() => {
    if (!snapshot) {
      return { disabled: true, reason: "Contract data not loaded yet." };
    }
    const rawAmount = burnAmount.trim();
    if (!rawAmount) {
      return { disabled: true, reason: "Enter burn amount." };
    }
    let parsedAmount: bigint;
    try {
      parsedAmount = ethers.parseUnits(rawAmount, snapshot.decimals);
    } catch {
      return { disabled: true, reason: "Amount has invalid format." };
    }
    if (parsedAmount <= 0n) {
      return { disabled: true, reason: "Amount must be greater than zero." };
    }
    if (parsedAmount > balance) {
      return { disabled: true, reason: "Insufficient balance to burn this amount." };
    }
    return { disabled: false, reason: "" };
  }, [balance, burnAmount, snapshot]);

  const performAction = useCallback(
    async (label: string, successMessage: string, action: () => Promise<void>) => {
      try {
        setLoadingAction(label);
        await action();
        if (successMessage) {
          setAlert("success", successMessage);
        }
      } catch (error: any) {
        console.error(error);
        const message =
          error?.reason ||
          error?.error?.message ||
          error?.shortMessage ||
          error?.message ||
          "Transaction failed";
        setAlert("error", message);
      } finally {
        setLoadingAction(null);
      }
    },
    [setAlert]
  );

  const submitSafeTransaction = useCallback(
    async (label: string, to: string, data: string, value: bigint = 0n) => {
      if (!SAFE_ADDRESS) {
        setAlert("error", "VITE_SAFE_ADDRESS must be set in the frontend environment");
        return null;
      }
      let submittedId: number | null = null;

      await performAction(label, "", async () => {
        const safeContract = await getWriteSafeContract();
        const response = await safeContract.submitTransaction(to, value, data);
        const receipt = await response.wait();

        for (const log of receipt.logs ?? []) {
          try {
            const parsed = safeContract.interface.parseLog(log);
            if (parsed?.name === "TransactionSubmitted") {
              submittedId = Number(parsed.args.txId);
              break;
            }
          } catch {
            // ignore unrelated logs
          }
        }

        await fetchSafeSnapshot();
        setAlert(
          "success",
          submittedId != null
            ? `Multisig transaction #${submittedId} submitted.`
            : "Multisig transaction submitted.",
        );
      });

      return submittedId;
    },
    [fetchSafeSnapshot, getWriteSafeContract, performAction, setAlert]
  );

  const handleClaim = useCallback(async () => {
    if (!snapshot) {
      setAlert("error", "Contract data not loaded");
      return;
    }
    await performAction("claim", "Claim successful", async () => {
      const contract = await getWriteContract();
      const tx = await contract.claimFreeTokens();
      await tx.wait();
      await Promise.all([fetchAccountState(), fetchContractSnapshot()]);
    });
  }, [fetchAccountState, fetchContractSnapshot, getWriteContract, performAction, setAlert, snapshot]);

  const handlePauseToggle = useCallback(async () => {
    if (!snapshot) {
      setAlert("error", "Contract data not loaded");
      return;
    }
    const fn = snapshot.paused ? "unpause" : "pause";
    await submitSafeTransaction(fn, CONTRACT_ADDRESS, tokenInterface.encodeFunctionData(fn, []));
  }, [snapshot, submitSafeTransaction, setAlert, tokenInterface]);

  const handleTransfer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!snapshot) {
        setAlert("error", "Contract data not loaded");
        return;
      }
      if (transferValidation.disabled) {
        if (transferValidation.reason) {
          setAlert("error", transferValidation.reason);
        }
        return;
      }
      const to = transferForm.to.trim();
      const amount = transferForm.amount.trim();
      let amountParsed: bigint;
      try {
        amountParsed = ethers.parseUnits(amount, snapshot.decimals);
      } catch {
        setAlert("error", "Amount has invalid format");
        return;
      }
      await performAction("transfer", "Transfer completed", async () => {
        const contract = await getWriteContract();
        const tx = await contract.transfer(to, amountParsed);
        await tx.wait();
        await Promise.all([fetchAccountState(), fetchContractSnapshot()]);
        setTransferForm({ to: "", amount: "" });
      });
    },
    [
      fetchAccountState,
      fetchContractSnapshot,
      getWriteContract,
      performAction,
      setAlert,
      snapshot,
      transferForm,
      transferValidation,
    ]
  );

  const handleBurn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!snapshot) {
        setAlert("error", "Contract data not loaded");
        return;
      }
      if (burnValidation.disabled) {
        if (burnValidation.reason) {
          setAlert("error", burnValidation.reason);
        }
        return;
      }
      let amountParsed: bigint;
      try {
        amountParsed = ethers.parseUnits(burnAmount, snapshot.decimals);
      } catch {
        setAlert("error", "Amount has invalid format");
        return;
      }
      await performAction("burn", "Tokens burned", async () => {
        const contract = await getWriteContract();
        const tx = await contract.burn(amountParsed);
        await tx.wait();
        await Promise.all([fetchAccountState(), fetchContractSnapshot()]);
        setBurnAmount("");
      });
    },
    [
      burnAmount,
      fetchAccountState,
      fetchContractSnapshot,
      getWriteContract,
      performAction,
      setAlert,
      snapshot,
      burnValidation,
    ]
  );

  const handleSetTreasury = useCallback(async () => {
    const targetAddress = treasuryInput.trim() || ZERO_ADDRESS;
    if (!ethers.isAddress(targetAddress)) {
      setAlert("error", "Enter a valid treasury address");
      return;
    }
    await submitSafeTransaction(
      "treasury",
      CONTRACT_ADDRESS,
      tokenInterface.encodeFunctionData("setTreasury", [targetAddress])
    );
  }, [submitSafeTransaction, setAlert, tokenInterface, treasuryInput]);

  const handleSetFee = useCallback(async () => {
    const fee = Number(feeInput);
    if (Number.isNaN(fee) || fee < 0 || fee > 500) {
      setAlert("error", "Fee must be between 0 and 500 bps");
      return;
    }
    await submitSafeTransaction(
      "fee",
      CONTRACT_ADDRESS,
      tokenInterface.encodeFunctionData("setFeeBps", [fee])
    );
  }, [feeInput, setAlert, submitSafeTransaction, tokenInterface]);

  const handleSetMaxTransfer = useCallback(async () => {
    if (!snapshot) {
      setAlert("error", "Contract data not loaded");
      return;
    }
    const value = maxTransferInput.trim();
    const amountParsed = value ? ethers.parseUnits(value, snapshot.decimals) : 0n;
    await submitSafeTransaction(
      "max-transfer",
      CONTRACT_ADDRESS,
      tokenInterface.encodeFunctionData("setMaxTransferAmount", [amountParsed])
    );
  }, [maxTransferInput, setAlert, snapshot, submitSafeTransaction, tokenInterface]);

  const handleWhitelist = useCallback(async () => {
    const address = whitelistForm.address.trim();
    if (!ethers.isAddress(address)) {
      setAlert("error", "Enter a valid address");
      return;
    }
    await submitSafeTransaction(
      "whitelist",
      CONTRACT_ADDRESS,
      tokenInterface.encodeFunctionData("setWhitelisted", [[address], whitelistForm.allowed])
    );
  }, [setAlert, submitSafeTransaction, tokenInterface, whitelistForm]);

  const handleConfirmTransaction = useCallback(
    async (txId: number) => {
      await performAction(`confirm-${txId}`, "Confirmation sent", async () => {
        const safeContract = await getWriteSafeContract();
        const tx = await safeContract.confirmTransaction(txId);
        await tx.wait();
        await fetchSafeSnapshot();
      });
    },
    [fetchSafeSnapshot, getWriteSafeContract, performAction]
  );

  const handleRevokeTransaction = useCallback(
    async (txId: number) => {
      await performAction(`revoke-${txId}`, "Confirmation revoked", async () => {
        const safeContract = await getWriteSafeContract();
        const tx = await safeContract.revokeConfirmation(txId);
        await tx.wait();
        await fetchSafeSnapshot();
      });
    },
    [fetchSafeSnapshot, getWriteSafeContract, performAction]
  );

  const handleExecuteTransaction = useCallback(
    async (txId: number) => {
      await performAction(`execute-${txId}`, "Transaction executed", async () => {
        const safeContract = await getWriteSafeContract();
        const tx = await safeContract.executeTransaction(txId);
        await tx.wait();
        await Promise.all([fetchSafeSnapshot(), fetchContractSnapshot()]);
      });
    },
    [fetchContractSnapshot, fetchSafeSnapshot, getWriteSafeContract, performAction]
  );

  const handleRefresh = useCallback(async () => {
    await performAction("refresh", "", async () => {
      await Promise.all([fetchContractSnapshot(), fetchAccountState()]);
    });
  }, [fetchAccountState, fetchContractSnapshot, performAction]);

  useEffect(() => {
    (async () => {
      try {
        await fetchContractSnapshot();
        if (!window.ethereum) {
          return;
        }
        const provider = await getProvider();
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const addr = accounts[0].address ?? accounts[0];
          setAccount(addr);
          await fetchAccountState(addr);
        }
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      providerRef.current = null;
    };
  }, [fetchContractSnapshot, fetchAccountState, getProvider]);

  useEffect(() => {
    if (!account) return;
    fetchAccountState(account);
  }, [account, fetchAccountState]);

  useEffect(() => {
    if (!account || !window.ethereum?.on) {
      return;
    }

    const eth = window.ethereum;

    const onAccountsChanged = async (accounts: string[] | string) => {
      const next = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!next) {
        localDisconnect();
        return;
      }
      setAccount(next);
      await fetchAccountState(next);
    };

    const onChainChanged = () => {
      setAlert("error", "Network changed. Please reconnect.");
      localDisconnect();
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, [account, fetchAccountState, localDisconnect, setAlert]);

  const legacyOwner = useMemo(() => {
    if (!account || !snapshot?.owner) return false;
    return account.toLowerCase() === snapshot.owner.toLowerCase();
  }, [account, snapshot?.owner]);

  const isSafeOwner = useMemo(() => {
    if (!account) return false;
    if (safeSnapshot?.owners?.length) {
      return safeSnapshot.owners.some((owner) => owner.toLowerCase() === account.toLowerCase());
    }
    return legacyOwner;
  }, [account, legacyOwner, safeSnapshot]);

  const roleLabel = useMemo(() => {
    if (!account) return "-";
    return isSafeOwner ? "Multisig Owner" : "User";
  }, [account, isSafeOwner]);

  const formattedBalance = useMemo(() => {
    if (!snapshot) return "0";
    return ethers.formatUnits(balance, snapshot.decimals);
  }, [balance, snapshot]);

  const formattedTotalSupply = useMemo(() => {
    if (!snapshot) return "-";
    return ethers.formatUnits(snapshot.totalSupply, snapshot.decimals);
  }, [snapshot]);

  const formattedClaimAmount = useMemo(() => {
    if (!snapshot) return "-";
    return ethers.formatUnits(snapshot.claimAmount, snapshot.decimals);
  }, [snapshot]);

  const maxTransferDisplay = useMemo(() => {
    if (!snapshot) return "-";
    if (snapshot.maxTransferAmount === 0n) return "Unlimited";
    return `${ethers.formatUnits(snapshot.maxTransferAmount, snapshot.decimals)} ${snapshot.symbol}`;
  }, [snapshot]);

  const treasuryLabel = useMemo(() => {
    if (!snapshot) return "-";
    return snapshot.treasury === ZERO_ADDRESS ? "Not set" : snapshot.treasury;
  }, [snapshot]);

  const tokenSymbol = snapshot?.symbol;

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <Header
          tokenAddress={CONTRACT_ADDRESS}
          safeAddress={safeSnapshot?.address ?? snapshot?.owner}
          account={account}
          roleLabel={roleLabel}
          isSafeOwner={isSafeOwner}
          isRefreshing={loadingAction === "refresh"}
          tokenName={snapshot?.name ?? "MyToken"}
          onConnect={connectWallet}
          onDisconnect={disconnect}
          onRefresh={handleRefresh}
        />

        {toast && <ToastBanner toast={toast} />}

        <OverviewCard
          snapshot={snapshot}
          account={account}
          roleLabel={roleLabel}
          safeSnapshot={safeSnapshot}
          formattedBalance={formattedBalance}
          formattedTotalSupply={formattedTotalSupply}
          formattedClaimAmount={formattedClaimAmount}
          maxTransferLabel={maxTransferDisplay}
          treasuryLabel={treasuryLabel}
        />

        {account && (
          <section className={styles.cardGrid}>
            <UserActions
              symbol={tokenSymbol}
              hasClaimed={hasClaimed}
              loadingAction={loadingAction}
              transferForm={transferForm}
              burnAmount={burnAmount}
              transferDisabledReason={transferValidation.reason}
              burnDisabledReason={burnValidation.reason}
              isTransferDisabled={loadingAction === "transfer" || transferValidation.disabled}
              isBurnDisabled={loadingAction === "burn" || burnValidation.disabled}
              onClaim={handleClaim}
              onTransferSubmit={handleTransfer}
              onBurnSubmit={handleBurn}
              onTransferChange={handleTransferFormChange}
              onBurnChange={handleBurnInputChange}
            />

            {isSafeOwner && (
              <OwnerControls
                account={account}
                snapshot={snapshot}
                safeSnapshot={safeSnapshot}
                loadingAction={loadingAction}
                treasuryInput={treasuryInput}
                feeInput={feeInput}
                maxTransferInput={maxTransferInput}
                whitelistAddress={whitelistForm.address}
                whitelistAllowed={whitelistForm.allowed}
                onPauseToggle={handlePauseToggle}
                onTreasuryInputChange={handleTreasuryInputChange}
                onSetTreasury={handleSetTreasury}
                onFeeInputChange={handleFeeInputChange}
                onSetFee={handleSetFee}
                onMaxTransferInputChange={handleMaxTransferInputChange}
                onSetMaxTransfer={handleSetMaxTransfer}
                onWhitelistAddressChange={handleWhitelistAddressChange}
                onWhitelistAllowedChange={handleWhitelistAllowedChange}
                onApplyWhitelist={handleWhitelist}
                onConfirmTransaction={handleConfirmTransaction}
                onRevokeTransaction={handleRevokeTransaction}
                onExecuteTransaction={handleExecuteTransaction}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
