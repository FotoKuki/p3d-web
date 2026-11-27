import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BrandLink from "../../brand-link";
import ThemeToggle from "../../theme-toggle";
import { getPrintOrder } from "../../../lib/account-store";
import { formatAddress, shippingMethods } from "../../../lib/shipping-options";
import { orderViewer } from "../../../lib/order-access";
import { orderNumber } from "../order-list";
import OrderTracking from "../order-tracking";
import { orderStatusLabel } from "../../../lib/order-progress";
import PaymentControls from "../payment-controls";
import styles from "../orders.module.css";

export const metadata = { title: "คำสั่งพิมพ์ | P3D", robots: { index: false, follow: false } };
const money = new Intl.NumberFormat("th-TH");
const paymentImage = "/payment/promptpay.png";

export default async function OrderPage({ params }) {
  const viewer = await orderViewer();
  if (!viewer) redirect("/account");
  const { id } = await params;
  const order = await getPrintOrder(id, viewer);
  if (!order) notFound();
  const { fileName, shipping, quote, printSettings } = order;
  const separateDelivery = shipping.method === "lalamove";
  const unpaid = order.status === "pending_payment";

  return (
    <>
      <header className="topbar"><div className="topbar-inner">
        <BrandLink />
        <div className={styles.headerActions}><ThemeToggle /><Link href="/orders">คำสั่งพิมพ์ของฉัน</Link></div>
      </div></header>
      <main className={styles.workspace}>
        <div className={styles.heading}><h1>คำสั่งพิมพ์ {orderNumber(id)}</h1><span className={styles.status}>{orderStatusLabel(order)}</span></div>
        <OrderTracking order={order} />
        <div className={styles.orderColumns}>
          <section className={styles.card} aria-labelledby="order-details">
            <h2 id="order-details">รายละเอียดคำสั่งพิมพ์</h2>
            <dl className={styles.details}>
              <div><dt>โมเดล</dt><dd>{fileName}</dd></div>
              <div><dt>ค่าพิมพ์</dt><dd>{printSettings.material} · {printSettings.quantity} ชุด · {printSettings.infill}% infill</dd></div>
              {printSettings.colorLabel && <div><dt>สีเส้น</dt><dd>{printSettings.colorLabel}</dd></div>}
              {shipping.method && <div><dt>วิธีจัดส่ง</dt><dd>{shippingMethods[shipping.method]?.name}</dd></div>}
              <div><dt>ค่าจัดส่ง</dt><dd>{separateDelivery ? "ชำระปลายทางแยกกับ LALAMOVE" : "฿" + money.format(quote.shipping)}</dd></div>
              <div><dt>ผู้รับ</dt><dd>{shipping.recipient} · {shipping.phone}</dd></div>
              <div><dt>ที่อยู่จัดส่ง</dt><dd>{formatAddress(shipping)}</dd></div>
              {shipping.contactName && <div><dt>ผู้สั่ง</dt><dd>{shipping.contactName} · {shipping.contactPhone}</dd></div>}
              {shipping.email && <div><dt>อีเมลผู้รับ</dt><dd>{shipping.email}</dd></div>}
              {shipping.note && <div><dt>หมายเหตุ</dt><dd>{shipping.note}</dd></div>}
              {shipping.useAsBilling && <div><dt>ข้อมูลออกบิล</dt><dd>ใช้ที่อยู่จัดส่ง{shipping.taxId ? " · เลขผู้เสียภาษี " + shipping.taxId : ""}</dd></div>}
              {shipping.mediaConsent && <div><dt>การเผยแพร่</dt><dd>อนุญาตให้เผยแพร่กระบวนการผลิตของคำสั่งพิมพ์นี้</dd></div>}
            </dl>
          </section>
          <section className={styles.card} aria-labelledby="payment-title">
            <h2 id="payment-title">{unpaid ? "ชำระด้วย PromptPay" : "ยอดคำสั่งพิมพ์"}</h2>
            <div className={styles.checkoutTotal}><span>{separateDelivery ? "ยอดค่าพิมพ์" : "ยอดรวมค่าจัดส่ง"}</span><strong>฿{money.format(quote.total)}</strong></div>
            {unpaid && <>
            <Image className={styles.qr} src={paymentImage} width={885} height={1200} unoptimized alt="QR PromptPay สำหรับชำระเงินให้ร้าน P3D" />
            <p className={styles.paymentNote}>ตรวจชื่อผู้รับและยอดเงินในแอปธนาคารก่อนยืนยัน หลังโอนแล้วแนบสลิปด้านล่างเพื่อให้ร้านตรวจยอด</p>
            <a className={styles.headerActionsLink} href={paymentImage} download>บันทึกรูป QR</a>
            {order.userId === viewer.id && <PaymentControls id={id} total={quote.total} reported={Boolean(order.paymentReportedAt)} />}
            </>}
          </section>
        </div>
      </main>
    </>
  );
}
