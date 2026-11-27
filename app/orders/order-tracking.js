import { Check } from "lucide-react";
import { getOrderStep, orderCarrier, orderStatusLabel, orderSteps, trackingDetails } from "../../lib/order-progress";
import { CopyTrackingNumber, RefreshProgress } from "./progress-controls";
import styles from "./orders.module.css";

const dates = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default function OrderTracking({ order }) {
  const current = getOrderStep(order.status);
  const currentIndex = orderSteps.indexOf(current);
  const carrier = orderCarrier(order);
  const { name, number, url } = trackingDetails(carrier, order.tracking);

  return (
    <section className={styles.trackingPanel + " " + styles.card} aria-labelledby="tracking-title">
      <div className={styles.heading}>
        <div><h2 id="tracking-title">สถานะการพิมพ์และจัดส่ง</h2>
          <p className={styles.muted}>อัปเดตล่าสุด {dates.format(order.tracking.updatedAt ?? order.createdAt)}</p>
        </div>
        <RefreshProgress />
      </div>
      <ol className={styles.progressList} aria-label="ความคืบหน้าคำสั่งพิมพ์">
        {orderSteps.map((step, index) => <li key={step.id}
          aria-current={step.id === current.id ? "step" : undefined}
          className={index < currentIndex ? styles.progressDone : undefined}>
          <span aria-hidden="true">{index < currentIndex ? <Check size={14} /> : index + 1}</span>
          <strong>{step.id === current.id ? orderStatusLabel(order) : step.label}</strong>
        </li>)}
      </ol>
      <div className={styles.trackingRow}>
        <h3>เลขติดตาม / {name}</h3>
        {number ? <code>{number}</code> : !url && <p className={styles.muted}>ร้านยังไม่ได้เพิ่มเลขติดตาม</p>}
        {number || url ? <div className={styles.headerActions}>
          {number && <CopyTrackingNumber number={number} />}
          {url && <a href={url} target="_blank" rel="noopener noreferrer">{carrier === "lalamove" ? "เปิดแผนที่ติดตาม LALAMOVE" : `เช็กพัสดุที่ ${name}`}</a>}
        </div> : null}
      </div>
    </section>
  );
}
