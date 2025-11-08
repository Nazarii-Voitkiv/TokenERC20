import buttonStyles from "../../styles/Button.module.css";
import cardStyles from "../../styles/Card.module.css";
import type { ContractSnapshot, SafeSnapshot } from "../../types";
import styles from "./OwnerControls.module.css";

type OwnerControlsProps = {
  account: string;
  snapshot: ContractSnapshot | null;
  safeSnapshot: SafeSnapshot | null;
  loadingAction: string | null;
  airdropAddress?: string;
  treasuryInput: string;
  feeInput: string;
  maxTransferInput: string;
  whitelistAddress: string;
  whitelistAllowed: boolean;
  merkleRootInput: string;
  onPauseToggle: () => void;
  onTreasuryInputChange: (value: string) => void;
  onSetTreasury: () => void;
  onFeeInputChange: (value: string) => void;
  onSetFee: () => void;
  onMaxTransferInputChange: (value: string) => void;
  onSetMaxTransfer: () => void;
  onWhitelistAddressChange: (value: string) => void;
  onWhitelistAllowedChange: (value: boolean) => void;
  onApplyWhitelist: () => void;
  onMerkleRootInputChange: (value: string) => void;
  onSetMerkleRoot: () => void;
  onConfirmTransaction: (txId: number) => void;
  onRevokeTransaction: (txId: number) => void;
  onExecuteTransaction: (txId: number) => void;
};

export function OwnerControls({
  account,
  snapshot,
  safeSnapshot,
  loadingAction,
  airdropAddress,
  treasuryInput,
  feeInput,
  maxTransferInput,
  whitelistAddress,
  whitelistAllowed,
  merkleRootInput,
  onPauseToggle,
  onTreasuryInputChange,
  onSetTreasury,
  onFeeInputChange,
  onSetFee,
  onMaxTransferInputChange,
  onSetMaxTransfer,
  onWhitelistAddressChange,
  onWhitelistAllowedChange,
  onApplyWhitelist,
  onMerkleRootInputChange,
  onSetMerkleRoot,
  onConfirmTransaction,
  onRevokeTransaction,
  onExecuteTransaction,
}: OwnerControlsProps) {
  const pendingTransactions =
    safeSnapshot?.transactions.filter((tx) => !tx.executed).sort((a, b) => b.id - a.id) ?? [];
  const trimmedMerkleRoot = merkleRootInput.trim();
  const merkleRootValid = /^0x[0-9a-fA-F]{64}$/.test(trimmedMerkleRoot);

  return (
    <article className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.cardHeaderTitle}>Multisig Controls</h2>
      </div>

      <div className={styles.safeSummary}>
        <div>
          <span className={styles.summaryLabel}>Threshold:&nbsp;</span>
          <span>{safeSnapshot ? `${safeSnapshot.threshold} approvals required` : "-"}</span>
        </div>
        <div className={styles.safeOwners}>
          <span className={styles.summaryLabel}>Owners:</span>
          <div className={styles.ownerList}>
            {safeSnapshot?.owners.length
              ? safeSnapshot.owners.map((owner) => (
                  <span
                    key={owner}
                    className={`${styles.ownerBadge} ${
                      owner.toLowerCase() === account.toLowerCase() ? styles.ownerBadgeSelf : ""
                    }`}
                  >
                    {owner}
                  </span>
                ))
              : "-"}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.actions}>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.warning}`}
            onClick={onPauseToggle}
            disabled={loadingAction === "pause" || loadingAction === "unpause"}
          >
            {snapshot?.paused ? "Propose Unpause" : "Propose Pause"}
          </button>
          <p className={styles.helper}>
            Creates a multisig transaction to toggle the global pause once it reaches the required
            confirmations.
          </p>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="treasury">
              Treasury Address
            </label>
            <input
              id="treasury"
              className={styles.input}
              placeholder="0x..."
              value={treasuryInput}
              onChange={(event) => onTreasuryInputChange(event.target.value)}
            />
          </div>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.solid}`}
            onClick={onSetTreasury}
            disabled={loadingAction === "treasury"}
            type="button"
          >
            Propose Treasury Update
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="fee">
              Fee (bps)
            </label>
            <input
              id="fee"
              type="number"
              min={0}
              max={500}
              className={styles.input}
              value={feeInput}
              onChange={(event) => onFeeInputChange(event.target.value)}
            />
          </div>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.solid}`}
            onClick={onSetFee}
            disabled={loadingAction === "fee"}
            type="button"
          >
            Propose Fee Update
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="max-transfer">
              Max Transfer{snapshot?.symbol ? ` (${snapshot.symbol})` : ""}
            </label>
            <input
              id="max-transfer"
              className={styles.input}
              placeholder="Leave empty for unlimited"
              value={maxTransferInput}
              onChange={(event) => onMaxTransferInputChange(event.target.value)}
            />
          </div>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.solid}`}
            onClick={onSetMaxTransfer}
            disabled={loadingAction === "max-transfer"}
            type="button"
          >
            Propose Limit Update
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="whitelist-address">
              Whitelist Address
            </label>
            <input
              id="whitelist-address"
              className={styles.input}
              placeholder="0x..."
              value={whitelistAddress}
              onChange={(event) => onWhitelistAddressChange(event.target.value)}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="whitelist-status">
              Status
            </label>
            <select
              id="whitelist-status"
              className={styles.select}
              value={whitelistAllowed ? "allow" : "revoke"}
              onChange={(event) => onWhitelistAllowedChange(event.target.value === "allow")}
            >
              <option value="allow">Allow</option>
              <option value="revoke">Revoke</option>
            </select>
          </div>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.solid}`}
            onClick={onApplyWhitelist}
            disabled={loadingAction === "whitelist"}
            type="button"
          >
            Propose Whitelist Update
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="merkle-root">
              Merkle Root
            </label>
            <input
              id="merkle-root"
              className={styles.input}
              placeholder="0x..."
              value={merkleRootInput}
              onChange={(event) => onMerkleRootInputChange(event.target.value)}
              disabled={!airdropAddress}
            />
          </div>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.solid}`}
            onClick={onSetMerkleRoot}
            disabled={
              !airdropAddress || !merkleRootValid || loadingAction === "merkle-root"
            }
            type="button"
          >
            Propose Merkle Root Update
          </button>
          {!airdropAddress ? (
            <p className={styles.helper}>Set VITE_AIRDROP_ADDRESS to enable this action.</p>
          ) : (
            <p className={styles.helper}>
              Calls <code>setMerkleRoot</code> on the Merkle airdrop once approved.
            </p>
          )}
        </div>

        <div className={styles.queue}>
          <div className={styles.queueHeader}>
            <h3 className={styles.queueTitle}>Pending Transactions</h3>
            <span className={styles.queueBadge}>{pendingTransactions.length}</span>
          </div>

          {pendingTransactions.length === 0 ? (
            <p className={styles.emptyQueue}>No multisig actions queued.</p>
          ) : (
            <div className={styles.txList}>
              {pendingTransactions.map((tx) => {
                const confirmedByAccount = tx.confirmations.some(
                  (owner) => owner.toLowerCase() === account.toLowerCase()
                );
                const canExecute =
                  safeSnapshot != null &&
                  tx.numConfirmations >= safeSnapshot.threshold &&
                  !tx.executed;
                return (
                  <div className={styles.txCard} key={tx.id}>
                    <div className={styles.txMeta}>
                      <div className={styles.txHeader}>
                        <span className={styles.txTitle}>Tx #{tx.id}</span>
                        <span className={styles.txConfirmations}>
                          {tx.numConfirmations}/{safeSnapshot?.threshold ?? "-"} approvals
                        </span>
                      </div>
                      <p className={styles.txDescription}>{tx.description}</p>
                      <div className={styles.txTarget}>
                        <span className={styles.summaryLabel}>Target:&nbsp;</span>
                        <span className={styles.mono}>{tx.to}</span>
                      </div>
                    </div>
                    <div className={styles.txActions}>
                      <button
                        className={`${buttonStyles.btn} ${buttonStyles.solid}`}
                        onClick={() => onConfirmTransaction(tx.id)}
                        disabled={loadingAction === `confirm-${tx.id}` || confirmedByAccount}
                        type="button"
                      >
                        {confirmedByAccount ? "Confirmed" : "Confirm"}
                      </button>
                      <button
                        className={`${buttonStyles.btn} ${buttonStyles.ghost}`}
                        onClick={() => onRevokeTransaction(tx.id)}
                        disabled={loadingAction === `revoke-${tx.id}` || !confirmedByAccount}
                        type="button"
                      >
                        Revoke
                      </button>
                      <button
                        className={`${buttonStyles.btn} ${buttonStyles.warning}`}
                        onClick={() => onExecuteTransaction(tx.id)}
                        disabled={loadingAction === `execute-${tx.id}` || !canExecute}
                        type="button"
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
