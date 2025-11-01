import buttonStyles from "../../styles/Button.module.css";
import cardStyles from "../../styles/Card.module.css";
import type { ContractSnapshot } from "../../types";
import styles from "./OwnerControls.module.css";

type OwnerControlsProps = {
  snapshot: ContractSnapshot | null;
  loadingAction: string | null;
  treasuryInput: string;
  feeInput: string;
  maxTransferInput: string;
  whitelistAddress: string;
  whitelistAllowed: boolean;
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
};

export function OwnerControls({
  snapshot,
  loadingAction,
  treasuryInput,
  feeInput,
  maxTransferInput,
  whitelistAddress,
  whitelistAllowed,
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
}: OwnerControlsProps) {
  return (
    <article className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.cardHeaderTitle}>Owner Controls</h2>
      </div>

      <div className={styles.body}>
        <div className={styles.actions}>
          <button
            className={`${buttonStyles.btn} ${buttonStyles.warning}`}
            onClick={onPauseToggle}
            disabled={loadingAction === "pause" || loadingAction === "unpause"}
          >
            {snapshot?.paused ? "Unpause Contract" : "Pause Contract"}
          </button>
          <p className={styles.helper}>
            Toggle global pause to temporarily stop transfers.
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
            Save Treasury
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
            Update Fee
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
            Set Limit
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
            Apply Whitelist Update
          </button>
        </div>
      </div>
    </article>
  );
}
