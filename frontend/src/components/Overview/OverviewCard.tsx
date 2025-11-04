import type { ContractSnapshot, SafeSnapshot } from "../../types";
import cardStyles from "../../styles/Card.module.css";
import styles from "./OverviewCard.module.css";

type OverviewCardProps = {
  snapshot: ContractSnapshot | null;
  account: string;
  roleLabel: string;
  safeSnapshot: SafeSnapshot | null;
  formattedBalance: string;
  formattedTotalSupply: string;
  formattedClaimAmount: string;
  maxTransferLabel: string;
  treasuryLabel: string;
};

export function OverviewCard({
  snapshot,
  account,
  roleLabel,
  safeSnapshot,
  formattedBalance,
  formattedTotalSupply,
  formattedClaimAmount,
  maxTransferLabel,
  treasuryLabel,
}: OverviewCardProps) {
  const statusClass =
    snapshot?.paused === true ? styles.statusPaused : styles.statusActive;

  const safeThreshold =
    safeSnapshot?.threshold != null ? `${safeSnapshot.threshold} approvals` : "-";

  const safeOwnersSummary = safeSnapshot?.owners?.length
    ? `${safeSnapshot.owners.length} wallet${safeSnapshot.owners.length > 1 ? "s" : ""}`
    : "-";

  return (
    <section className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.cardHeaderTitle}>Overview</h2>
        <span className={`${styles.status} ${statusClass}`}>
          {snapshot?.paused ? "Paused" : "Active"}
        </span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Connected Wallet</span>
          <span className={`${styles.statValue} ${styles.mono}`}>
            {account || "Not connected"}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Role</span>
          <span className={styles.statValue}>{account ? roleLabel : "-"}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Balance</span>
          <span className={styles.statValue}>
            {formattedBalance} {snapshot?.symbol ?? ""}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Supply</span>
          <span className={styles.statValue}>
            {formattedTotalSupply} {snapshot?.symbol ?? ""}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Treasury</span>
          <span className={`${styles.statValue} ${styles.mono}`}>{treasuryLabel}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Fee</span>
          <span className={styles.statValue}>
            {snapshot ? `${snapshot.feeBps} bps` : "-"}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Max Transfer</span>
          <span className={styles.statValue}>{maxTransferLabel}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Claim Amount</span>
          <span className={styles.statValue}>
            {formattedClaimAmount} {snapshot?.symbol ?? ""}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Multisig Threshold</span>
          <span className={styles.statValue}>{safeThreshold}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Multisig Owners</span>
          <span className={styles.statValue}>{safeOwnersSummary}</span>
        </div>
      </div>
    </section>
  );
}
