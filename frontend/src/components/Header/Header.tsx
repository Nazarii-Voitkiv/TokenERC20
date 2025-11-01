import buttonStyles from "../../styles/Button.module.css";
import styles from "./Header.module.css";

type HeaderProps = {
  contractAddress: string;
  account: string;
  isOwner: boolean;
  isRefreshing: boolean;
  tokenName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
};

export function Header({
  contractAddress,
  account,
  isOwner,
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
          Contract&nbsp;
          <span className={styles.mono}>{contractAddress}</span>
        </p>
      </div>

      <div className={styles.actions}>
        {account ? (
          <>
            <span className={`${styles.roleBadge} ${isOwner ? styles.roleBadgeOwner : ""}`}>
              {isOwner ? "Owner" : "User"}
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
