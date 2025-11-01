import type { Toast as ToastPayload } from "../../types";
import styles from "./Toast.module.css";

type ToastProps = {
  toast: ToastPayload;
};

export function Toast({ toast }: ToastProps) {
  const toneClass = toast.type === "success" ? styles.success : styles.error;
  return (
    <div className={`${styles.toast} ${toneClass}`}>
      {toast.message}
    </div>
  );
}
