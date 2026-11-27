export const orderAssignees = ["โต้", "ภูมิ"];

export const orderSteps = [
  { id: "pending_payment", label: "รอชำระเงิน" },
  { id: "paid", label: "ชำระเงินแล้ว" },
  { id: "queued", label: "รอคิว" },
  { id: "printing", label: "กำลังพิมพ์" },
  { id: "ready_to_ship", label: "พิมพ์แล้ว" },
  { id: "shipped", label: "จัดส่งแล้ว" },
  { id: "delivered", label: "ส่งถึงแล้ว" },
];

export function getOrderStep(status) {
  return orderSteps.find((step) => step.id === status) ?? orderSteps[0];
}

export function orderStatusLabel(order) {
  return order.status === "pending_payment" && order.paymentReportedAt ? "รอตรวจยอด" : getOrderStep(order.status).label;
}

export function validateLalamoveShareLink(input) {
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === "share.lalamove.com" && !url.port
      && !url.username && !url.password && !url.hash ? url.href : null;
  } catch {
    return null;
  }
}


export const trackingCarriers = {
  postal: { label: "ไปรษณีย์ไทย", trackingUrl: "https://track.thailandpost.co.th/?lang=th" },
  flash: { label: "Flash Express", trackingUrl: "https://www.flashexpress.co.th/en/fle/tracking/" },
  jt: { label: "J&T Express", trackingUrl: "https://www.jtexpress.co.th/service/track" },
  spx: { label: "SPX Express", trackingUrl: "https://spx.co.th/en" },
  kex: { label: "KEX Express", trackingUrl: "https://th.kex-express.com/en/track-parcel" },
  dhl: { label: "DHL Express", trackingUrl: "https://www.dhl.com/th-en/home/tracking.html" },
  lalamove: { label: "LALAMOVE" },
  other: { label: "ขนส่งอื่น" },
};

export function trackingDetails(carrier, tracking) {
  const entry = trackingCarriers[carrier];
  const name = (carrier === "other" && tracking.carrierName) || entry?.label || "ขนส่ง";
  const number = tracking.number;
  const url = carrier === "lalamove" ? validateLalamoveShareLink(tracking.url) : number && entry?.trackingUrl;
  return { name, number, url };
}

export function orderCarrier(order) {
  return order.tracking.carrier ?? (order.shipping.method === "lalamove" ? "lalamove" : "postal");
}

export function orderNumber(id) {
  return "P3D-" + id.slice(0, 8).toUpperCase();
}

