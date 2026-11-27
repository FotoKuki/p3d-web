"use server";

import { revalidatePath } from "next/cache";
import { reportPrintPayment } from "../../lib/account-store";
import { orderViewer } from "../../lib/order-access";

export async function submitPaymentSlip(id, _previous, form) {
  const viewer = await orderViewer();
  if (!viewer) return { error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  const file = form.get("slip");
  if (typeof file?.arrayBuffer !== "function" || file.size < 12 || file.size > 2 * 1024 * 1024) {
    return { error: "เลือกภาพสลิป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB" };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? "image/png"
      : bytes.subarray(0, 3).toString("hex") === "ffd8ff" ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
    if (!mime) return { error: "ไฟล์สลิปต้องเป็นภาพ JPG, PNG หรือ WebP" };
    if (!(await reportPrintPayment(id, viewer.id, mime, bytes))) {
      return { error: "แจ้งโอนสำหรับออเดอร์นี้ไม่ได้ กรุณาเปิดหน้าออเดอร์อีกครั้ง" };
    }
  } catch {
    return { error: "บันทึกสลิปไม่ได้ กรุณาลองอีกครั้ง" };
  }
  for (const path of ["/orders/" + id, "/orders", "/account", "/admin/orders/" + id, "/admin/orders"]) revalidatePath(path);
  return { message: "ส่งสลิปแล้ว ร้านกำลังตรวจสอบยอดโอน" };
}
