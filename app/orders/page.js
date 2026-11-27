import Link from "next/link";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  MessageCircle,
  Plus,
  Truck,
} from "lucide-react";
import { googleEnabled, legacyLineEnabled, lineEnabled } from "../../auth";
import { enterAccount } from "../account/actions";
import BrandLink from "../brand-link";
import ThemeToggle from "../theme-toggle";
import { listPrintOrders } from "../../lib/account-store";
import { orderViewer } from "../../lib/order-access";
import { getOrderStep, orderSteps } from "../../lib/order-progress";
import { orderNumber } from "./order-list";
import StlThumbnail from "../admin/orders/stl-thumbnail";
import styles from "./my-queue.module.css";

export const metadata = {
  title: "คิวของฉัน | P3D",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("th-TH");
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

function statusClass(status) {
  if (status === "pending_payment") return `${styles.statusBadge} ${styles.statusPending}`;
  if (status === "shipped" || status === "delivered") return `${styles.statusBadge} ${styles.statusDone}`;
  return `${styles.statusBadge} ${styles.statusActive}`;
}

export default async function OrdersPage() {
  const viewer = await orderViewer();

  if (!viewer) {
    return (
      <>
        <header className="topbar">
          <div className="topbar-inner">
            <BrandLink />
            <div className={styles.headerActions}>
              <Link href="/estimate" className={styles.navLink}>ประเมินราคา</Link>
              <Link href="/account" className={styles.navLink}>คลิกเพื่อล็อกอิน</Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className={styles.workspace}>
          <section className={styles.centerCard} aria-labelledby="queue-signin-title">
            <div className={styles.centerIcon} aria-hidden="true">
              <ClipboardList size={26} />
            </div>
            <h1 id="queue-signin-title" className={styles.centerTitle}>คิวของฉัน</h1>
            <p>เข้าสู่ระบบด้วยบัญชี Google หรือ LINE เพื่อดูรายการที่คุณสั่งพิมพ์และติดตามสถานะคิวแบบเรียลไทม์</p>
            <div className={styles.authActions}>
              {googleEnabled && (
                <form action={enterAccount.bind(null, "google", undefined)}>
                  <button type="submit" className={styles.googleBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z" />
                      <path fill="#FBBC05" d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l4-3.09Z" />
                      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z" />
                    </svg>
                    <span>เข้าสู่ระบบด้วย Google</span>
                  </button>
                </form>
              )}
              {lineEnabled && (
                <form action={enterAccount.bind(null, "line", undefined)}>
                  <button type="submit" className={styles.lineBtn}>
                    <MessageCircle size={18} aria-hidden="true" />
                    <span>เข้าสู่ระบบด้วย LINE</span>
                  </button>
                </form>
              )}
              {!googleEnabled && !lineEnabled && (
                <Link href="/account" className={styles.newOrderBtn}>เข้าสู่ระบบ</Link>
              )}
              {legacyLineEnabled && <Link href="/account">เคยเข้าสู่ระบบด้วย LINE เดิม</Link>}
            </div>
          </section>
        </main>
        <footer className={styles.pageFooter}>© {new Date().getFullYear()} P3D Printing and Design</footer>
      </>
    );
  }

  const orders = await listPrintOrders(viewer.id);
  const completedCount = orders.filter((o) => o.status === "shipped" || o.status === "delivered").length;
  const activeCount = orders.length - completedCount;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <BrandLink />
          <div className={styles.headerActions}>
            <Link href="/estimate" className={styles.navLink}>ประเมินราคา</Link>
            <Link href="/account" className={styles.navLink}>บัญชี</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={styles.workspace}>
        <div className={styles.pageHeader}>
          <div>
            <h1>คิวของฉัน</h1>
            <p>ตรวจสอบรายการที่คุณสั่งพิมพ์และติดตามความคืบหน้าของแต่ละชิ้นงาน</p>
          </div>
          <Link href="/estimate" className={styles.newOrderBtn}>
            <Plus size={17} aria-hidden="true" />
            <span>สั่งพิมพ์เพิ่ม</span>
          </Link>
        </div>

        {orders.length > 0 && (
          <section className={styles.statsGrid} aria-label="สรุปคิวของฉัน">
            <div className={styles.statCard}>
              <span className={styles.statLabel}>
                <span>รายการทั้งหมด</span>
                <Layers size={16} aria-hidden="true" />
              </span>
              <strong>{orders.length}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>
                <span>กำลังดำเนินการ</span>
                <Clock size={16} aria-hidden="true" />
              </span>
              <strong>{activeCount}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>
                <span>จัดส่งแล้ว / เสร็จสิ้น</span>
                <CheckCircle2 size={16} aria-hidden="true" />
              </span>
              <strong>{completedCount}</strong>
            </div>
          </section>
        )}

        {orders.length === 0 ? (
          <section className={styles.centerCard} aria-label="ยังไม่มีคำสั่งพิมพ์">
            <div className={styles.centerIcon} aria-hidden="true">
              <Box size={26} />
            </div>
            <h2>ยังไม่มีคำสั่งพิมพ์ในคิว</h2>
            <p>อัปโหลดไฟล์ STL, OBJ หรือ 3MF เพื่อประเมินราคาและส่งงานเข้าคิวพิมพ์ได้เลย</p>
            <Link href="/estimate" className={styles.newOrderBtn}>
              <Plus size={17} aria-hidden="true" />
              <span>เริ่มประเมินราคา</span>
            </Link>
          </section>
        ) : (
          <section className={styles.orderGrid} aria-label="รายการคำสั่งพิมพ์ของฉัน">
            {orders.map((order) => {
              const step = getOrderStep(order.status);
              const stepIndex = Math.max(0, orderSteps.findIndex((s) => s.id === step.id));
              const unpaid = order.status === "pending_payment";
              const { printSettings } = order;

              return (
                <article key={order.id} className={styles.orderCard}>
                  <div className={styles.cardMain}>
                    <StlThumbnail
                      orderId={order.id}
                      fileName={order.fileName}
                      color={printSettings?.color}
                      modelUrl={`/orders/${order.id}/model`}
                    />

                    <div className={styles.info}>
                      <div className={styles.topMeta}>
                        <span className={styles.orderCode}>{orderNumber(order.id)}</span>
                        <span className={statusClass(order.status)}>{step.label}</span>
                        <span className={styles.orderDate}>
                          {dateFormatter.format(new Date(Number(order.createdAt) || Date.now()))}
                        </span>
                      </div>

                      <h2 className={styles.fileName} title={order.fileName}>
                        {order.fileName}
                      </h2>

                      <div className={styles.specs}>
                        {printSettings?.material && (
                          <span className={styles.specChip}>{printSettings.material}</span>
                        )}
                        {printSettings?.quantity && (
                          <span className={styles.specChip}>{printSettings.quantity} ชุด</span>
                        )}
                        {printSettings?.layerHeight && (
                          <span className={styles.specChip}>ชั้น {printSettings.layerHeight} มม.</span>
                        )}
                        {printSettings?.infill != null && (
                          <span className={styles.specChip}>Infill {printSettings.infill}%</span>
                        )}
                      </div>

                      {order.tracking?.number && (
                        <div className={styles.trackingNote}>
                          <Truck size={14} aria-hidden="true" />
                          <span>เลขพัสดุ: {order.tracking.number}</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.sideCol}>
                      <strong className={styles.price}>฿{money.format(order.quote.total)}</strong>
                      <Link
                        href={"/orders/" + order.id}
                        className={`${styles.detailBtn} ${unpaid ? styles.detailBtnPay : ""}`}
                      >
                        <span>{unpaid ? "ชำระเงิน / ดูรายละเอียด" : "ดูรายละเอียด"}</span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  <div className={styles.progressStrip}>
                    <div className={styles.progressHeader}>
                      <span>
                        ขั้นตอนที่ {stepIndex + 1} จาก {orderSteps.length}: <strong>{step.label}</strong>
                      </span>
                      <span>{Math.round(((stepIndex + 1) / orderSteps.length) * 100)}%</span>
                    </div>
                    <div className={styles.progressTrack} aria-hidden="true">
                      {orderSteps.map((s, idx) => (
                        <span
                          key={s.id}
                          className={`${styles.progressSeg} ${
                            idx < stepIndex
                              ? styles.progressSegDone
                              : idx === stepIndex
                                ? styles.progressSegCurrent
                                : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
      <footer className={styles.pageFooter}>© {new Date().getFullYear()} P3D Printing and Design</footer>
    </>
  );
}
