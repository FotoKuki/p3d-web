import { notFound, redirect } from "next/navigation";
import { listFilamentStock } from "../../../lib/account-store";
import { orderViewer } from "../../../lib/order-access";
import { isAdminSite } from "../../../lib/site-role";
import { materials } from "../../pricing";
import AdminFrame from "../frame";
import StockBoard from "./stock-board";

export const metadata = { title: "สต๊อกเส้นพลาสติก | P3D", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FilamentStock() {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) redirect("/admin/sign-in");

  return <AdminFrame viewer={viewer} active="stock">
    <StockBoard stock={await listFilamentStock()} materials={Object.keys(materials)} />
  </AdminFrame>;
}
