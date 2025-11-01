import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import MyToken from "./abi/MyToken.json";
import { Header } from "./components/Header/Header";
import { OverviewCard } from "./components/Overview/OverviewCard";
import { UserActions } from "./components/UserActions/UserActions";
import { OwnerControls } from "./components/OwnerControls/OwnerControls";
import { Toast as ToastBanner } from "./components/Toast/Toast";
import styles from "./App.module.css";
import type { ContractSnapshot, Toast } from "./types";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
const ZERO_ADDRESS = ethers.ZeroAddress;

function App() {
  const [account, setAccount] = useState<string>("");
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
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
    } catch (error) {
      console.error(error);
    }
  }, [getReadContract]);

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
    await performAction(snapshot.paused ? "unpause" : "pause", "Contract state updated", async () => {
      const contract = await getWriteContract();
      const tx = snapshot.paused ? await contract.unpause() : await contract.pause();
      await tx.wait();
      await fetchContractSnapshot();
    });
  }, [fetchContractSnapshot, getWriteContract, performAction, setAlert, snapshot]);

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
    await performAction("treasury", "Treasury updated", async () => {
      const contract = await getWriteContract();
      const tx = await contract.setTreasury(targetAddress);
      await tx.wait();
      await fetchContractSnapshot();
    });
  }, [fetchContractSnapshot, getWriteContract, performAction, setAlert, treasuryInput]);

  const handleSetFee = useCallback(async () => {
    const fee = Number(feeInput);
    if (Number.isNaN(fee) || fee < 0 || fee > 500) {
      setAlert("error", "Fee must be between 0 and 500 bps");
      return;
    }
    await performAction("fee", "Fee updated", async () => {
      const contract = await getWriteContract();
      const tx = await contract.setFeeBps(fee);
      await tx.wait();
      await fetchContractSnapshot();
    });
  }, [fetchContractSnapshot, feeInput, getWriteContract, performAction, setAlert]);

  const handleSetMaxTransfer = useCallback(async () => {
    if (!snapshot) {
      setAlert("error", "Contract data not loaded");
      return;
    }
    const value = maxTransferInput.trim();
    const amountParsed = value ? ethers.parseUnits(value, snapshot.decimals) : 0n;
    await performAction("max-transfer", "Max transfer threshold updated", async () => {
      const contract = await getWriteContract();
      const tx = await contract.setMaxTransferAmount(amountParsed);
      await tx.wait();
      await fetchContractSnapshot();
    });
  }, [fetchContractSnapshot, getWriteContract, maxTransferInput, performAction, setAlert, snapshot]);

  const handleWhitelist = useCallback(async () => {
    const address = whitelistForm.address.trim();
    if (!ethers.isAddress(address)) {
      setAlert("error", "Enter a valid address");
      return;
    }
    await performAction(
      "whitelist",
      whitelistForm.allowed ? "Address whitelisted" : "Address removed from whitelist",
      async () => {
        const contract = await getWriteContract();
        const tx = await contract.setWhitelisted(address, whitelistForm.allowed);
        await tx.wait();
        await fetchContractSnapshot();
      }
    );
  }, [fetchContractSnapshot, getWriteContract, performAction, setAlert, whitelistForm]);

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

  const isOwner = useMemo(() => {
    if (!account || !snapshot?.owner) return false;
    return account.toLowerCase() === snapshot.owner.toLowerCase();
  }, [account, snapshot?.owner]);

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
          contractAddress={CONTRACT_ADDRESS}
          account={account}
          isOwner={isOwner}
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
          isOwner={isOwner}
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

            {isOwner && (
              <OwnerControls
                snapshot={snapshot}
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
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
