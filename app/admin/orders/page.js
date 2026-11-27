import { notFound, redirect } from "next/navigation";
import OrdersDashboard from "./orders-dashboard";
import { listPrintOrders } from "../../../lib/account-store";
import { orderViewer } from "../../../lib/order-access";
import { isAdminSite } from "../../../lib/site-role";

export const metadata = { title: "คำสั่งพิมพ์ของร้าน | P3D", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) redirect("/admin/sign-in");
  const orders = await listPrintOrders();

  return <OrdersDashboard initialOrders={orders} viewer={viewer} />;
}
