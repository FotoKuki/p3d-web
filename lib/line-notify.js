import { createHash } from "node:crypto";
import { getUserLineId } from "./account-store";
import { getOrderStep, trackingDetails } from "./order-progress";
import { customerOrigin } from "./site-role";

const money = new Intl.NumberFormat("th-TH");

function customerOrderRetryKey(orderId) {
  // Use the order UUID as the namespace, so admin and customer pushes have distinct keys.
  const uuid = createHash("sha1").update(Buffer.from(orderId.replaceAll("-", ""), "hex"))
    .update("p3d:customer-order-created").digest().subarray(0, 16);
  uuid[6] = (uuid[6] & 0x0f) | 0x50;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  return uuid.toString("hex").replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
}

const statusHeadlines = {
  paid: "ยืนยันการชำระเงินแล้ว ✅",
  queued: "นำงานเข้าคิวพิมพ์แล้ว 📋",
  printing: "กำลังพิมพ์ชิ้นงานของคุณ 🖨️",
  ready_to_ship: "พิมพ์ชิ้นงานเสร็จเรียบร้อยแล้ว ✨",
  shipped: "จัดส่งพัสดุแล้ว 🚚",
  delivered: "จัดส่งสำเร็จแล้ว 🎉",
};

async function pushLineText(userId, text, retryKey) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token || !userId) return false;

  try {
    const lineUserId = await getUserLineId(userId);
    if (!lineUserId) return false;

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}),
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 409 && retryKey && response.headers.has("x-line-accepted-request-id")) return true;
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("P3D LINE customer notice failed:", response.status, detail);
      return false;
    }
    return true;
  } catch (error) {
    console.error("P3D LINE customer notice error:", error?.message || error);
    return false;
  }
}

export function notifyCustomerLineConnected(userId) {
  const text = [
    "สวัสดีครับ จาก P3D Printing and Design",
    "เชื่อมบัญชี LINE กับเว็บไซต์ P3D สำเร็จแล้วครับ",
    "คุณจะได้รับแจ้งเตือนคำสั่งพิมพ์ สถานะงาน และเลขพัสดุผ่านแชทนี้",
    "",
    "พิมพ์ «สวัสดี» ตอบกลับในแชทนี้ได้เลย เพื่อให้แอดมินติดต่อคุณเรื่องงานพิมพ์และการจัดส่งได้ครับ",
  ].join("\n");
  return pushLineText(userId, text);
}

export async function notifyCustomerOrderCreated({ userId, orderId, fileName, printSettings, quote }) {
  const orderCode = "P3D-" + orderId.slice(0, 8).toUpperCase();
  const orderUrl = new URL("/orders/" + orderId, customerOrigin()).href;
  const material = printSettings?.material || "-";
  const qty = printSettings?.quantity || 1;
  const total = money.format(quote?.total ?? 0);

  const text = [
    "คำสั่งพิมพ์สำเร็จ 🎉",
    `เลขที่คำสั่ง: ${orderCode}`,
    `ไฟล์งาน: ${fileName}`,
    `วัสดุ: ${material} · ${qty} ชุด`,
    `ยอดรวม: ฿${total}`,
    "",
    "ติดตามคิวและสถานะงานพิมพ์ได้ที่:",
    orderUrl,
  ].join("\n");

  return pushLineText(userId, text, customerOrderRetryKey(orderId));
}

export async function notifyCustomerOrderStatus({ userId, orderId, fileName, status, tracking }) {
  const orderCode = "P3D-" + orderId.slice(0, 8).toUpperCase();
  const orderUrl = new URL("/orders/" + orderId, customerOrigin()).href;
  const stepLabel = getOrderStep(status).label;
  const headline = statusHeadlines[status] || `อัปเดตสถานะ: ${stepLabel}`;

  const lines = [
    headline,
    `เลขที่คำสั่ง: ${orderCode}`,
    `ไฟล์งาน: ${fileName}`,
    `สถานะปัจจุบัน: ${stepLabel}`,
  ];

  const { name, number, url } = trackingDetails(tracking?.carrier, tracking ?? {});
  if (tracking?.carrier || number) lines.push(`ขนส่ง: ${name}`);
  if (number) lines.push(`เลขพัสดุ: ${number}`);
  if (url) lines.push(`ติดตามขนส่ง: ${url}`);

  lines.push("", "ดูรายละเอียดคิวของคุณ:", orderUrl);

  return pushLineText(userId, lines.join("\n"));
}
