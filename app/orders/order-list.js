import Link from "next/link";
import { orderStatusLabel, orderNumber } from "../../lib/order-progress";
import styles from "./orders.module.css";

const money = new Intl.NumberFormat("th-TH");

export { orderNumber };

export function OrderList({ orders, orderPath = "/orders/" }) {
  if (!orders.length) return <p className={styles.muted}>ยังไม่มีคำสั่งพิมพ์</p>;
  return (
    <ul className={styles.orderList}>
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={orderPath + order.id}>{orderNumber(order.id)}<small>{order.fileName}</small></Link>
          <span>฿{money.format(order.quote.total)}<small>{orderStatusLabel(order)}</small>{order.tracking.number && <small>{order.tracking.number}</small>}</span>
        </li>
      ))}
    </ul>
  );
}
