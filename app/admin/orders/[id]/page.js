import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Layers, Truck } from "lucide-react";
import AdminFrame from "../../frame";
import { getPrintOrder } from "../../../../lib/account-store";
import { orderViewer } from "../../../../lib/order-access";
import { getOrderStep, orderCarrier, orderStatusLabel, orderSteps } from "../../../../lib/order-progress";
import { isAdminSite } from "../../../../lib/site-role";
import { formatAddress, shippingMethods } from "../../../../lib/shipping-options";
import { orderNumber } from "../../../orders/order-list";
import { EditPrintProgress, ConfirmPayment } from "../../../orders/progress-controls";
import AssigneeSelect from "../assignee-select";
import StlThumbnail from "../stl-thumbnail";
import styles from "./order-detail.module.css";

export const metadata = { title: "จัดการคำสั่งพิมพ์ | P3D", robots: { index: false, follow: false } };

const money = new Intl.NumberFormat("th-TH");
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

function statusClass(status) {
  if (status === "pending_payment") return `${styles.statusPill} ${styles.statusPending}`;
  if (status === "shipped" || status === "delivered") return `${styles.statusPill} ${styles.statusDone}`;
  return `${styles.statusPill} ${styles.statusActive}`;
}

export default async function ManageOrder({ params }) {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) redirect("/admin/sign-in");
  const { id } = await params;
  const order = await getPrintOrder(id, viewer);
  if (!order) notFound();
  const { shipping, printSettings, quote } = order;
  const paidAt = order.tracking.paymentConfirmedAt;
  const step = getOrderStep(order.status);
  const currentIndex = Math.max(0, orderSteps.findIndex((item) => item.id === step.id));

  return (
    <AdminFrame viewer={viewer} active="orders">
      <div className={styles.page}>
        <Link className={styles.backLink} href="/admin/orders">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>กลับไปที่รายการคำสั่งพิมพ์</span>
        </Link>

        {/* Hero Summary Card */}
        <section className={styles.heroCard} aria-label="สรุปคำสั่งพิมพ์">
          <div className={styles.heroTop}>
            <div className={styles.heroLeft}>
              <StlThumbnail
                orderId={id}
                fileName={order.fileName}
                color={printSettings?.color}
              />
              <div className={styles.heroMeta}>
                <div className={styles.heroTitleRow}>
                  <h1>{orderNumber(id)}</h1>
                  <span className={statusClass(order.status)}>{orderStatusLabel(order)}</span>
                </div>
                <span className={styles.heroFile}>{order.fileName}</span>
                <span className={styles.heroDate}>
                  สั่งเมื่อ {dateFormatter.format(new Date(Number(order.createdAt) || Date.now()))}
                </span>
              </div>
            </div>

            <div className={styles.heroRight}>
              <div className={styles.totalBox}>
                <span>ยอดรวมทั้งหมด</span>
                <strong>฿{money.format(quote.total)}</strong>
              </div>
              <a className={styles.downloadBtn} href={"/admin/orders/" + id + "/model"}>
                <Download size={16} aria-hidden="true" />
                <span>ดาวน์โหลดไฟล์งานพิมพ์</span>
              </a>
            </div>
          </div>

          <div className={styles.progressBar}>
            <ol className={styles.progressSteps} aria-label="ขั้นตอนงานพิมพ์">
              {orderSteps.map((s, idx) => (
                <li
                  key={s.id}
                  className={`${styles.progressStep} ${
                    idx < currentIndex
                      ? styles.stepDone
                      : idx === currentIndex
                        ? styles.stepCurrent
                        : ""
                  }`}
                >
                  <span className={styles.stepLine} aria-hidden="true" />
                  <span className={styles.stepLabel}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Two-Column Workspace */}
        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <section className={styles.card} aria-labelledby="specs-title">
              <div className={styles.cardHead}>
                <h2 id="specs-title">
                  <Layers size={17} aria-hidden="true" />
                  รายละเอียดการพิมพ์และผู้ดูแลคิว
                </h2>
              </div>

              <div className={styles.specChips}>
                <span className={styles.specChip}>{printSettings.material}</span>
                {printSettings.colorLabel && <span className={styles.specChip}>{printSettings.colorLabel}</span>}
                <span className={styles.specChip}>{printSettings.quantity} ชุด</span>
                <span className={styles.specChip}>Infill {printSettings.infill}%</span>
                {printSettings.layerHeight && (
                  <span className={styles.specChip}>ชั้น {printSettings.layerHeight} มม.</span>
                )}
                {printSettings.wallCount && (
                  <span className={styles.specChip}>{printSettings.wallCount} ผนัง</span>
                )}
                <span className={styles.specChip}>Support: {printSettings.support ? "เปิด" : "ปิด"}</span>
              </div>

              <dl className={styles.details}>
                <div>
                  <dt>ผู้ดูแลคิว</dt>
                  <dd><AssigneeSelect orderId={id} value={order.assignee || ""} compact={false} /></dd>
                </div>
                <div>
                  <dt>ไฟล์โมเดล</dt>
                  <dd>{order.fileName}</dd>
                </div>
                {shipping.note && (
                  <div>
                    <dt>หมายเหตุลูกค้า</dt>
                    <dd>{shipping.note}</dd>
                  </div>
                )}
                {shipping.mediaConsent && (
                  <div>
                    <dt>การเผยแพร่</dt>
                    <dd>ลูกค้ายินยอมให้เผยแพร่กระบวนการผลิต</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className={styles.card} aria-labelledby="shipping-title">
              <div className={styles.cardHead}>
                <h2 id="shipping-title">
                  <Truck size={17} aria-hidden="true" />
                  ข้อมูลลูกค้าและการจัดส่ง
                </h2>
              </div>

              <dl className={styles.details}>
                <div>
                  <dt>วิธีจัดส่ง</dt>
                  <dd>{shippingMethods[shipping.method ?? "postal"]?.name}</dd>
                </div>
                <div>
                  <dt>ผู้รับ</dt>
                  <dd>
                    {shipping.recipient} ·{" "}
                    <a href={"tel:" + shipping.phone}>{shipping.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>ที่อยู่จัดส่ง</dt>
                  <dd>{formatAddress(shipping)}</dd>
                </div>
                {shipping.contactName && (
                  <div>
                    <dt>ผู้สั่ง</dt>
                    <dd>
                      {shipping.contactName} ·{" "}
                      <a href={"tel:" + shipping.contactPhone}>{shipping.contactPhone}</a>
                    </dd>
                  </div>
                )}
                {shipping.email && (
                  <div>
                    <dt>อีเมล</dt>
                    <dd><a href={"mailto:" + shipping.email}>{shipping.email}</a></dd>
                  </div>
                )}
                {shipping.useAsBilling && (
                  <div>
                    <dt>ออกบิล</dt>
                    <dd>ใช้ที่อยู่จัดส่ง{shipping.taxId ? " · เลขผู้เสียภาษี " + shipping.taxId : ""}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>

          <div className={styles.rightCol}>
            <ConfirmPayment
              id={id}
              version={order.progressVersion}
              isPending={order.status === "pending_payment"}
              total={quote.total}
              paidAt={paidAt}
              paymentReportedAt={order.paymentReportedAt}
              testPayment={order.tracking.testPayment}
            />
            <EditPrintProgress
              id={id}
              status={order.status}
              tracking={order.tracking}
              version={order.progressVersion}
              savedCarrier={orderCarrier(order)}
            />
          </div>
        </div>
      </div>
    </AdminFrame>
  );
}
