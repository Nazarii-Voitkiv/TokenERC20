import buttonStyles from "../../styles/Button.module.css";
import styles from "./Header.module.css";

type HeaderProps = {
  tokenAddress: string;
  safeAddress?: string;
  account: string;
  roleLabel: string;
  isSafeOwner: boolean;
  isRefreshing: boolean;
  tokenName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
};

export function Header({
  tokenAddress,
  safeAddress,
  account,
  roleLabel,
  isSafeOwner,
  isRefreshing,
  tokenName,
  onConnect,
  onDisconnect,
  onRefresh,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>
          {tokenName ? `${tokenName} Control Center` : "Control Center"}
        </h1>
        <p className={styles.muted}>
          Token&nbsp;
          <span className={styles.mono}>{tokenAddress}</span>
        </p>
        {safeAddress && (
          <p className={styles.muted}>
            Multisig&nbsp;
            <span className={styles.mono}>{safeAddress}</span>
          </p>
        )}
      </div>

      <div className={styles.actions}>
        {account ? (
          <>
            <span className={`${styles.roleBadge} ${isSafeOwner ? styles.roleBadgeOwner : ""}`}>
              {roleLabel}
            </span>
            <button
              className={`${buttonStyles.btn} ${buttonStyles.ghost}`}
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              Refresh
            </button>
            <button
              className={`${buttonStyles.btn} ${buttonStyles.outline}`}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            className={`${buttonStyles.btn} ${buttonStyles.primary}`}
            onClick={onConnect}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
