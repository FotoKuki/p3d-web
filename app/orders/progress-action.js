"use server";

import { revalidatePath } from "next/cache";
import { getPrintOrder, updatePrintProgress } from "../../lib/account-store";
import { notifyCustomerOrderStatus } from "../../lib/line-notify";
import { orderViewer } from "../../lib/order-access";
import { orderSteps, orderCarrier, trackingCarriers, validateLalamoveShareLink } from "../../lib/order-progress";
import { fieldText } from "../../lib/shipping";

const stale = { error: "คำสั่งพิมพ์ถูกอัปเดตแล้ว กรุณารีเฟรชก่อนแก้ไข" };

async function editableOrder(id, form) {
  const viewer = await orderViewer();
  if (!viewer?.admin) return { error: "เฉพาะแอดมินที่อัปเดตคำสั่งพิมพ์ได้" };
  const order = await getPrintOrder(id, viewer);
  if (!order) return { error: "ไม่พบคำสั่งพิมพ์" };
  const rawVersion = fieldText(form, "version");
  if (!rawVersion || Number(rawVersion) !== order.progressVersion) return stale;
  return { order, viewer };
}

function refreshOrder(id) {
  revalidatePath("/admin/orders/" + id);
  revalidatePath("/admin/orders");
  revalidatePath("/orders/" + id);
  revalidatePath("/orders");
  revalidatePath("/account");
}

export async function confirmPrintPayment(id, _previous, form) {
  const { order, viewer, error } = await editableOrder(id, form);
  if (error) return { error };
  if (order.status !== "pending_payment") return { error: "คำสั่งพิมพ์นี้ผ่านขั้นตอนชำระเงินแล้ว" };
  if (form.get("paymentChecked") !== "on") return { error: "ยืนยันว่าตรวจสอบยอดเงินแล้วก่อนบันทึก" };

  const now = Date.now();
  const nextTracking = {
    ...order.tracking, paymentConfirmedAt: now, paymentConfirmedBy: viewer.id, updatedAt: now,
  };
  if (!(await updatePrintProgress(id, order.progressVersion, "paid", nextTracking))) return stale;
  await notifyCustomerOrderStatus({
    userId: order.userId, orderId: id, fileName: order.fileName, status: "paid", tracking: nextTracking,
  });
  refreshOrder(id);
  return { message: "ยืนยันการชำระเงินแล้ว" };
}

export async function savePrintProgress(id, _previous, form) {
  const { order, error } = await editableOrder(id, form);
  if (error) return { error };

  const status = fieldText(form, "status");
  if (!orderSteps.some((step) => step.id === status)) return { error: "เลือกสถานะคำสั่งพิมพ์" };
  if (status !== order.status && (status === "pending_payment" || order.status === "pending_payment")) {
    return { error: "ยืนยันยอดโอนในส่วนการชำระเงินก่อนเปลี่ยนสถานะ" };
  }

  const carrier = fieldText(form, "carrier");
  if (!Object.hasOwn(trackingCarriers, carrier)) return { error: "เลือกบริษัทขนส่ง" };
  const carrierName = carrier === "other" ? fieldText(form, "carrierName") : "";
  if (carrier === "other" && (!carrierName || carrierName.length > 80)) return { error: "กรอกชื่อบริษัทขนส่งไม่เกิน 80 ตัวอักษร" };

  const raw = fieldText(form, "trackingNumber").replace(/\s+/g, "");
  const number = carrier === "postal" ? raw.toUpperCase() : raw;
  const enteredUrl = carrier === "lalamove" ? fieldText(form, "trackingUrl") : "";
  const url = validateLalamoveShareLink(enteredUrl);
  if (number && !(carrier === "postal" ? /^[A-Z0-9]{13}$/ : /^[A-Za-z0-9-]{1,64}$/).test(number)) {
    return { error: carrier === "postal" ? "กรอกเลขติดตามไปรษณีย์ 13 ตัวอักษร" : "กรอกเลขติดตามเป็นตัวอักษรอังกฤษ ตัวเลข หรือขีดกลาง" };
  }
  if (enteredUrl && !url) return { error: "ใช้ลิงก์ติดตามแบบ HTTPS จาก share.lalamove.com" };

  if (status === order.status && carrier === orderCarrier(order)
    && carrierName === (order.tracking.carrierName ?? "") && number === (order.tracking.number ?? "")
    && (url ?? "") === (order.tracking.url ?? "")) return { message: "ข้อมูลนี้บันทึกไว้แล้ว" };

  const nextTracking = {
    ...order.tracking, carrier, carrierName, number, url, updatedAt: Date.now(),
  };
  if (!(await updatePrintProgress(id, order.progressVersion, status, nextTracking))) return stale;
  await notifyCustomerOrderStatus({
    userId: order.userId, orderId: id, fileName: order.fileName, status, tracking: nextTracking,
  });
  refreshOrder(id);
  return { message: "บันทึกสถานะคำสั่งพิมพ์แล้ว" };
}
