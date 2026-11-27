"use client";

import { useActionState, useState } from "react";
import { submitPaymentSlip } from "./payment-action";
import styles from "./orders.module.css";

export default function PaymentControls({ id, total, reported }) {
  const [result, action, pending] = useActionState(submitPaymentSlip.bind(null, id), null);
  const [copyStatus, setCopyStatus] = useState("");
  const submitted = reported || result?.message;
  return <div className={styles.paymentControls}>
    <button type="button" className={styles.secondaryButton} onClick={async () => {
      try {
        await navigator.clipboard.writeText(total.toFixed(2));
        setCopyStatus("คัดลอกยอดโอนแล้ว");
      } catch {
        setCopyStatus("คัดลอกอัตโนมัติไม่ได้ กรุณาใช้ยอดด้านบน");
      }
    }}>คัดลอกยอดโอน</button>
    {copyStatus && <p className={styles.muted} role="status">{copyStatus}</p>}
    {submitted && <p className={styles.success} role="status">{result?.message || "รอตรวจยอด ร้านได้รับสลิปแล้ว"}</p>}
    <form action={action} className={styles.checkoutForm}>
      <label>แนบสลิปโอนเงิน (JPG, PNG, WebP ไม่เกิน 2 MB)
        <input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required />
      </label>
      {result?.error && <p className="alert" role="alert">{result.error}</p>}
      <button className={styles.primary} type="submit" disabled={pending}>{pending ? "กำลังส่งสลิป…" : submitted ? "ส่งสลิปใหม่" : "แจ้งโอนเงิน"}</button>
    </form>
  </div>;
}
