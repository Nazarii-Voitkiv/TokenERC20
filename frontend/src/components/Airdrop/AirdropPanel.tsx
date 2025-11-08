import { ethers } from "ethers";
import type {
  AccountClaim,
  AirdropDataset,
  AirdropSnapshot,
} from "../../types";
import cardStyles from "../../styles/Card.module.css";
import buttonStyles from "../../styles/Button.module.css";
import styles from "./AirdropPanel.module.css";

type AirdropPanelProps = {
  symbol?: string;
  decimals?: number;
  snapshot: AirdropSnapshot | null;
  data: AirdropDataset | null;
  claim: AccountClaim | null;
  isClaimed: boolean;
  loadingAction: string | null;
  onClaim: () => void;
  dataSource?: string;
};

export function AirdropPanel({
  symbol,
  decimals,
  snapshot,
  data,
  claim,
  isClaimed,
  loadingAction,
  onClaim,
  dataSource,
}: AirdropPanelProps) {
  const contractRoot = snapshot?.merkleRoot ?? "—";
  const fileRoot = data?.merkleRoot ?? "—";
  const hasRoots = contractRoot !== "—" && fileRoot !== "—";
  const rootsMatch =
    hasRoots && contractRoot.toLowerCase() === fileRoot.toLowerCase();

  const tokenDecimals = decimals ?? data?.decimals ?? 18;
  const balanceLabel = snapshot
    ? ethers.formatUnits(snapshot.balance, tokenDecimals)
    : "0";
  const totalAllocated = data?.totals?.totalAllocatedFormatted ?? "0";
  const recipients = data?.totals?.uniqueAccounts ?? 0;
  const totalActivity = data?.totals?.totalActivity ?? 0;

  const claimDisabled =
    !claim || isClaimed || loadingAction === "airdrop-claim" || !rootsMatch;
  const claimLabel = isClaimed
    ? "Already claimed"
    : !claim
      ? "No allocation"
      : `Claim ${claim.amountFormatted} ${symbol ?? ""}`.trim();

  const helperText = (() => {
    if (!data) return "Airdrop JSON not loaded. Check VITE_AIRDROP_DATA_URL.";
    if (!claim) return "No entry for the connected wallet in the Merkle tree.";
    if (isClaimed) return "Tokens already withdrawn for this index.";
    if (!rootsMatch) return "Roots do not match — update contract or JSON.";
    return `Proof length: ${claim.proof.length}`;
  })();

  return (
    <article className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.cardHeaderTitle}>Merkle Airdrop</h2>
        {snapshot?.address && (
          <p className={cardStyles.cardHeaderSubtitle}>{snapshot.address}</p>
        )}
      </div>

      <div className={styles.rootRow}>
        <div>
          <p className={styles.label}>On-chain root</p>
          <code className={styles.rootValue}>{contractRoot}</code>
        </div>
        <div>
          <p className={styles.label}>File root</p>
          <code className={styles.rootValue}>{fileRoot}</code>
        </div>
      </div>
      <p
        className={`${styles.status} ${
          rootsMatch ? styles.statusOk : styles.statusWarn
        }`}
      >
        {rootsMatch
          ? "Roots match"
          : "Root mismatch — check AIRDROP_MERKLE_ROOT and data file"}
      </p>

      <div className={styles.metaGrid}>
        <div>
          <p className={styles.label}>Recipients</p>
          <p className={styles.value}>{recipients}</p>
        </div>
        <div>
          <p className={styles.label}>Total activity</p>
          <p className={styles.value}>{totalActivity}</p>
        </div>
        <div>
          <p className={styles.label}>Total allocated</p>
          <p className={styles.value}>
            {totalAllocated} {symbol ?? ""}
          </p>
        </div>
        <div>
          <p className={styles.label}>Contract balance</p>
          <p className={styles.value}>
            {balanceLabel} {symbol ?? ""}
          </p>
        </div>
      </div>

      <div className={styles.claimBox}>
        <div className={styles.claimHeader}>
          <p className={styles.claimTitle}>Your allocation</p>
          {data?.generatedAt && (
            <span className={styles.generatedAt}>
              Generated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {claim ? (
          <dl className={styles.claimDetails}>
            <div>
              <dt>Index</dt>
              <dd>{claim.index}</dd>
            </div>
            <div>
              <dt>Activity score</dt>
              <dd>{claim.activityCount}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>
                {claim.amountFormatted} {symbol ?? ""}
              </dd>
            </div>
          </dl>
        ) : (
          <p className={styles.helper}>No allocation for this wallet.</p>
        )}

        <button
          className={`${buttonStyles.btn} ${buttonStyles.primary}`}
          disabled={claimDisabled}
          onClick={onClaim}
        >
          {loadingAction === "airdrop-claim" ? "Processing..." : claimLabel}
        </button>
        <p className={styles.helper}>{helperText}</p>
      </div>

      {dataSource && (
        <p className={styles.dataSource}>
          Data source: <code>{dataSource}</code>
        </p>
      )}
    </article>
  );
}
