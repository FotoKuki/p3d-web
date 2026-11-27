import { setTimeout as delay } from "node:timers/promises";
import { getPendingOrderNotice, markOrderNoticeSent } from "./account-store";
import { orderNumber } from "./order-progress";
import { adminOrigin } from "./site-role";

const baht = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

export async function notifyNewPrintOrder(id) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  const recipient = process.env.LINE_ADMIN_RECIPIENT_ID?.trim();
  if (!token || !recipient) return;

  const quote = await getPendingOrderNotice(id);
  if (!quote) return;

  const link = new URL("/admin/orders/" + id, adminOrigin()).href;
  const body = JSON.stringify({
    to: recipient,
    messages: [{
      type: "text",
      text: "คำสั่งพิมพ์ใหม่ • " + orderNumber(id) + "\nยอดคำสั่งพิมพ์ " + baht.format(quote.total) + "\nเปิดหลังบ้าน " + link,
    }],
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": id,
      },
      body,
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);

    if (response?.ok || (response?.status === 409 && response.headers.has("x-line-accepted-request-id"))) {
      await markOrderNoticeSent(id);
      return;
    }
    if (attempt === 1 || (response && response.status < 500)) {
      throw new Error(response ? "LINE push failed (" + response.status + ")" : "LINE push timed out or could not connect");
    }
    await delay(350);
  }
}
