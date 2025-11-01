import type { FormEvent } from "react";
import buttonStyles from "../../styles/Button.module.css";
import cardStyles from "../../styles/Card.module.css";
import styles from "./UserActions.module.css";

type TransferFormState = {
  to: string;
  amount: string;
};

type UserActionsProps = {
  symbol?: string;
  hasClaimed: boolean;
  loadingAction: string | null;
  transferForm: TransferFormState;
  burnAmount: string;
  isTransferDisabled: boolean;
  isBurnDisabled: boolean;
  transferDisabledReason?: string;
  burnDisabledReason?: string;
  onClaim: () => void;
  onTransferSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBurnSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTransferChange: (field: keyof TransferFormState, value: string) => void;
  onBurnChange: (value: string) => void;
};

export function UserActions({
  symbol,
  hasClaimed,
  loadingAction,
  transferForm,
  burnAmount,
  isTransferDisabled,
  isBurnDisabled,
  transferDisabledReason,
  burnDisabledReason,
  onClaim,
  onTransferSubmit,
  onBurnSubmit,
  onTransferChange,
  onBurnChange,
}: UserActionsProps) {
  return (
    <article className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.cardHeaderTitle}>User Actions</h2>
      </div>

      <div className={styles.actions}>
        <button
          className={`${buttonStyles.btn} ${buttonStyles.primary}`}
          onClick={onClaim}
          disabled={hasClaimed || loadingAction === "claim"}
        >
          {hasClaimed ? "Already Claimed" : "Claim Free Tokens"}
        </button>
        <p className={styles.helper}>
          {hasClaimed
            ? "You have already claimed your free allocation."
            : "One-time claim of free tokens."}
        </p>
      </div>

      <form className={styles.form} onSubmit={onTransferSubmit}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="transfer-to">
            Recipient
          </label>
          <input
            id="transfer-to"
            name="to"
            className={styles.input}
            placeholder="0x..."
            value={transferForm.to}
            onChange={(event) => onTransferChange("to", event.target.value)}
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="transfer-amount">
            Amount{symbol ? ` (${symbol})` : ""}
          </label>
          <input
            id="transfer-amount"
            name="amount"
            className={styles.input}
            placeholder="0.0"
            value={transferForm.amount}
            onChange={(event) => onTransferChange("amount", event.target.value)}
          />
        </div>
        <button
          className={`${buttonStyles.btn} ${buttonStyles.solid}`}
          type="submit"
          disabled={isTransferDisabled}
        >
          Send Tokens
        </button>
        {isTransferDisabled && transferDisabledReason && (
          <p className={styles.helper}>{transferDisabledReason}</p>
        )}
      </form>

      <form className={styles.form} onSubmit={onBurnSubmit}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="burn-amount">
            Burn Amount{symbol ? ` (${symbol})` : ""}
          </label>
          <input
            id="burn-amount"
            className={styles.input}
            placeholder="0.0"
            value={burnAmount}
            onChange={(event) => onBurnChange(event.target.value)}
          />
        </div>
        <button
          className={`${buttonStyles.btn} ${buttonStyles.ghost}`}
          type="submit"
          disabled={isBurnDisabled}
        >
          Burn
        </button>
        {isBurnDisabled && burnDisabledReason && (
          <p className={styles.helper}>{burnDisabledReason}</p>
        )}
      </form>
    </article>
  );
}
