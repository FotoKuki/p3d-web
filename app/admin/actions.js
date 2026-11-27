"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { googleEnabled, signIn, signOut } from "../../auth";
import { restorePrintOrder, softDeletePrintOrder, updateOrderAssignee } from "../../lib/account-store";
import { orderViewer } from "../../lib/order-access";
import { orderAssignees } from "../../lib/order-progress";
import { isAdminSite } from "../../lib/site-role";

export async function enterAdmin() {
  if (!isAdminSite()) notFound();
  if (!googleEnabled || !process.env.P3D_ADMIN_EMAILS?.trim()) redirect("/admin/sign-in");
  if ((await orderViewer())?.admin) redirect("/admin/orders");

  // Auth.js otherwise treats the Google callback as an attempt to link it to the current customer account.
  await signOut({ redirect: false, redirectTo: "/admin/sign-in" });
  await signIn("google", { redirectTo: "/admin/orders" }, { prompt: "select_account" });
}

export async function leaveAdmin() {
  if (!isAdminSite()) notFound();
  await signOut({ redirectTo: "/admin/sign-in" });
}

export async function assignOrderCaretaker(orderId, assignee) {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) return { error: "ไม่มีสิทธิ์ทำรายการ" };
  if (typeof orderId !== "string" || !/^[a-f0-9-]{36}$/.test(orderId)) {
    return { error: "ไม่พบคำสั่งพิมพ์" };
  }
  const value = typeof assignee === "string" ? assignee.trim() : "";
  if (value !== "" && !orderAssignees.includes(value)) {
    return { error: "ผู้ดูแลไม่ถูกต้อง" };
  }
  const updated = await updateOrderAssignee(orderId, value);
  if (!updated) return { error: "บันทึกผู้ดูแลไม่สำเร็จ" };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  return { ok: true, assignee: value };
}

export async function deleteAdminOrder(orderId) {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) return { error: "ไม่มีสิทธิ์ทำรายการ" };
  if (typeof orderId !== "string" || !/^[a-f0-9-]{36}$/.test(orderId)) {
    return { error: "ไม่พบคำสั่งพิมพ์" };
  }
  const deleted = await softDeletePrintOrder(orderId);
  if (!deleted) return { error: "ลบคิวไม่สำเร็จ" };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  return { ok: true };
}

export async function restoreAdminOrder(orderId) {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (!viewer?.admin) return { error: "ไม่มีสิทธิ์ทำรายการ" };
  if (typeof orderId !== "string" || !/^[a-f0-9-]{36}$/.test(orderId)) {
    return { error: "ไม่พบคำสั่งพิมพ์" };
  }
  const restored = await restorePrintOrder(orderId);
  if (!restored) return { error: "กู้คืนคิวไม่สำเร็จ" };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  return { ok: true };
}