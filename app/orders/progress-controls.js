"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { orderSteps, trackingCarriers } from "../../lib/order-progress";
import { confirmPrintPayment, savePrintProgress } from "./progress-action";
import styles from "./orders.module.css";

const money = new Intl.NumberFormat("th-TH");
const dates = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export function RefreshProgress() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className={styles.secondaryButton} type="button" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw size={15} aria-hidden="true" /> {pending ? "กำลังอัปเดต…" : "รีเฟรชสถานะ"}
  </button>;
}

export function CopyTrackingNumber({ number }) {
  const [message, setMessage] = useState("");
  return <>
    <button type="button" className={styles.secondaryButton} onClick={async () => {
      try {
        await navigator.clipboard.writeText(number);
        setMessage("คัดลอกแล้ว");
      } catch {
        setMessage("โปรดเลือกเลขเพื่อคัดลอก");
      }
    }}><Copy size={15} aria-hidden="true" /> คัดลอกเลข</button>
    {message && <span className={styles.muted} role="status">{message}</span>}
  </>;
}

export function ConfirmPayment({ id, version, isPending, total, paidAt, paymentReportedAt, testPayment }) {
  const [result, action, pending] = useActionState(confirmPrintPayment.bind(null, id), null);

  return <section className={styles.card} aria-labelledby="confirm-payment-title">
    <h2 id="confirm-payment-title">การชำระเงิน</h2>
    <div className={styles.checkoutTotal}><span>{isPending ? "ยอดที่ต้องตรวจสอบ" : "ยอดคำสั่งพิมพ์"}</span><strong>฿{money.format(total)}</strong></div>
    {paymentReportedAt && <p className={styles.muted}>แจ้งโอน {dates.format(paymentReportedAt)} · <a href={"/admin/orders/" + id + "/slip"} target="_blank" rel="noreferrer">เปิดดูสลิป</a></p>}
    {isPending && (
      <form action={action} className={styles.checkoutForm}>
          <input type="hidden" name="version" value={version} />
          <label className={styles.inlineCheckbox}><input name="paymentChecked" type="checkbox" required /> ตรวจสอบแล้วว่าได้รับเงินตามยอดนี้</label>
          {result?.error && <p className="alert" role="alert">{result.error}</p>}
          <button className={styles.primary} type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "ยืนยันว่าได้รับเงินแล้ว"}</button>
      </form>
    )}
    {!isPending && <p className={styles.success} role="status">
      {testPayment ? "ชำระเงินแล้วในโหมดทดสอบ" : "ชำระเงินแล้ว"}{paidAt ? " · " + dates.format(paidAt) : ""}
    </p>}
  </section>;
}

export function EditPrintProgress({ id, status, tracking, version, savedCarrier }) {
  const [result, action, pending] = useActionState(savePrintProgress.bind(null, id), null);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [carrier, setCarrier] = useState(savedCarrier);
  const [carrierName, setCarrierName] = useState(tracking.carrierName ?? "");
  const [number, setNumber] = useState(tracking.number ?? "");
  const [url, setUrl] = useState(tracking.url ?? "");
  const unpaid = status === "pending_payment";
  const available = unpaid ? [orderSteps[0]] : orderSteps.slice(1);

  useEffect(() => {
    setSelectedStatus(status);
    setCarrier(savedCarrier);
    setCarrierName(tracking.carrierName ?? "");
    setNumber(tracking.number ?? "");
    setUrl(tracking.url ?? "");
  }, [status, savedCarrier, tracking.carrierName, tracking.number, tracking.url, version]);

  return (
    <section className={styles.card} aria-labelledby="admin-progress-title">
      <h2 id="admin-progress-title">สถานะงานและจัดส่ง</h2>
      <form action={action} className={styles.checkoutForm}>
        <input type="hidden" name="version" value={version} />
        {unpaid && <input type="hidden" name="status" value={status} />}
        <label>สถานะคำสั่งพิมพ์
          <select name={unpaid ? undefined : "status"} value={unpaid ? status : selectedStatus} disabled={unpaid}
            onChange={(event) => setSelectedStatus(event.target.value)}>
            {available.map((step) => <option key={step.id} value={step.id}>{step.label}</option>)}
          </select>
        </label>
        {unpaid && <p className={styles.muted}>ยืนยันยอดโอนก่อนเปลี่ยนสถานะงาน</p>}
        <label>บริษัทขนส่ง
          <select name="carrier" value={carrier} onChange={(event) => {
            setCarrier(event.target.value);
            setCarrierName("");
            setNumber("");
            setUrl("");
          }}>
            {Object.entries(trackingCarriers).map(([value, choice]) => <option key={value} value={value}>{choice.label}</option>)}
          </select>
        </label>
        {carrier === "other" && <label>ชื่อบริษัทขนส่ง
          <input name="carrierName" value={carrierName} onChange={(event) => setCarrierName(event.target.value)} maxLength={80} required />
        </label>}
        <label>เลขติดตามพัสดุ
          <input name="trackingNumber" value={number} onChange={(event) => setNumber(event.target.value)} maxLength={64}
            placeholder={carrier === "postal" ? "เช่น EF582568151TH" : "เลขติดตามจากบริษัทขนส่ง"} />
        </label>
        {carrier === "lalamove" && <label>ลิงก์ติดตาม LALAMOVE
          <input name="trackingUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048}
            placeholder="https://share.lalamove.com/..." />
        </label>}
        {result?.error && <p className="alert" role="alert">{result.error}</p>}
        {result?.message && <p className={styles.success} role="status">{result.message}</p>}
        <button className={styles.primary} type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกสถานะ"}</button>
      </form>
    </section>
  );
}

