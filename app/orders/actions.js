"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { zipSync } from "fflate";
import { maxPlates } from "../plate-layout";
import { File } from "node:buffer";
import { estimate, materials, settings } from "../pricing";
import { readModel } from "../model";
import { fitsPlate, fitsPlateBounds } from "../placement";
import { createPrintOrder, getAccountProfile, getOrderByRequest } from "../../lib/account-store";
import { notifyCustomerOrderCreated } from "../../lib/line-notify";
import { orderViewer } from "../../lib/order-access";
import { notifyNewPrintOrder } from "../../lib/order-notifications";
import { infillOptions, layerOptions, wallOptions } from "../../lib/print-options";
import { shippingMethods } from "../../lib/shipping-options";
import { fieldText, shippingFromForm, validPhone } from "../../lib/shipping";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxTriangles = 240_000;

function notifyAfterCheckout(id) {
  after(async () => {
    try {
      await notifyNewPrintOrder(id);
    } catch (error) {
      console.error("P3D new order LINE notification failed:", id, error.message);
    }
  });
}

function optionsFrom(form) {
  const material = fieldText(form, "material");
  const stockId = fieldText(form, "stockId");
  const color = fieldText(form, "color");
  const colorLabel = fieldText(form, "colorLabel");
  const layerHeight = Number(fieldText(form, "layerHeight"));
  const infill = Number(fieldText(form, "infill"));
  const wallCount = Number(fieldText(form, "wallCount"));
  const quantity = Number(fieldText(form, "quantity"));
  const support = fieldText(form, "support") === "true";
  if (
    !Object.hasOwn(materials, material) ||
    !layerOptions.some((option) => option.value === layerHeight) ||
    !infillOptions.includes(infill) ||
    !wallOptions.some((option) => option.value === wallCount) ||
    !Number.isInteger(quantity) || quantity < 1 || quantity > 100
  ) return null;
  return { material, stockId, color, colorLabel, layerHeight, infill, wallCount, quantity, support };
}

async function analyzeUpload(upload) {
  if (!upload || typeof upload.arrayBuffer !== "function" || upload.size < 134 || upload.size > 84 + maxTriangles * 50) {
    return null;
  }
  const buffer = await upload.arrayBuffer();
  const triangles = new DataView(buffer).getUint32(80, true);
  if (triangles === 0 || buffer.byteLength !== 84 + triangles * 50) return null;

  try {
    const model = await readModel(new File([buffer], "model.stl"));
    const { size, volume, sourceBounds } = model;
    model.geometry.dispose();
    return { size, volume, sourceBounds, bytes: new Uint8Array(buffer) };
  } catch {
    return null;
  }
}

export async function submitPrintOrder(form) {
  const viewer = await orderViewer();
  if (!viewer) return { error: "กรุณาเข้าสู่ระบบใหม่ก่อนส่งคำสั่งพิมพ์", signIn: true };

  const requestId = fieldText(form, "requestId");
  if (!requestIdPattern.test(requestId)) return { error: "เปิดหน้าสั่งพิมพ์ใหม่แล้วลองอีกครั้ง" };
  const existing = await getOrderByRequest(viewer.id, requestId);
  if (existing) {
    notifyAfterCheckout(existing.id);
    return { id: existing.id };
  }

  const options = optionsFrom(form);
  const fileName = fieldText(form, "fileName");
  if (!options || !fileName || fileName.length > 255) return { error: "ตรวจไฟล์และค่าพิมพ์แล้วลองอีกครั้ง" };
  if (!requestIdPattern.test(options.stockId)) return { error: "กรุณากลับไปเลือกสีจากสต๊อกในหน้าประเมินราคา" };

  const method = fieldText(form, "method");
  const contactName = fieldText(form, "contactName");
  const contactPhone = fieldText(form, "contactPhone");
  const note = fieldText(form, "note");
  if (!Object.hasOwn(shippingMethods, method) || !contactName || contactName.length > 120 || !validPhone(contactPhone) || note.length > 500) {
    return { error: "ตรวจชื่อผู้สั่ง เบอร์โทร หมายเหตุ และวิธีจัดส่ง" };
  }
  const addressId = fieldText(form, "addressId");
  let shipping, saveAddress = false;
  if (addressId) {
    const address = (await getAccountProfile(viewer.id))?.addresses.find((item) => item.id === addressId);
    if (!address) return { error: "ไม่พบที่อยู่ในบัญชีนี้ กรุณาเลือกที่อยู่อื่นหรือกรอกใหม่" };
    const { id: _id, ...snapshot } = address;
    shipping = snapshot;
  } else {
    if (!fieldText(form, "label")) form.set("label", "ที่อยู่จัดส่ง");
    const { data, error } = shippingFromForm(form);
    if (error) return { error };
    shipping = data;
    saveAddress = form.get("saveAddress") === "on" ? data : false;
  }

  const uploads = form.getAll("model");
  if (!uploads.length || uploads.length > maxPlates ||
    uploads.reduce((size, upload) => size + (upload?.size ?? 0), 0) > 84 * uploads.length + maxTriangles * 50) {
    return { error: "ไฟล์สำหรับพิมพ์มีขนาดใหญ่เกินไป" };
  }
  const names = uploads.map(upload => upload.name);
  if (uploads.length > 1 && (new Set(names).size !== names.length || names.some(name => {
    const match = /^plate-([1-9]\d*)\.stl$/.exec(name ?? "");
    return !match || Number(match[1]) > maxPlates;
  }))) return { error: "ตรวจหมายเลขเพลตไม่สำเร็จ ลองเลือกโมเดลอีกครั้ง" };
  const models = [];
  for (const upload of uploads) {
    const model = await analyzeUpload(upload);
    if (!model) return { error: "ตรวจไฟล์สำหรับพิมพ์ไม่สำเร็จ ลองเลือกโมเดลอีกครั้ง" };
    if (!fitsPlate(model.size, settings.buildSize)) return { error: "โมเดลเกินขนาดพิมพ์ในแนววางที่เลือก" };
    if (!fitsPlateBounds(model.sourceBounds, settings.buildSize)) return { error: "ตำแหน่งชิ้นงานอยู่นอกพื้นที่พิมพ์ กรุณากลับไปจัดวางใหม่" };
    models.push(model);
  }

  const quote = estimate({ volume: models.reduce((total, model) => total + model.volume, 0) }, options, method);
  if (Number(fieldText(form, "expectedTotal")) !== quote.total) {
    return { quoteTotal: quote.total, error: "ยอดประเมินเปลี่ยน กรุณาตรวจยอดใหม่แล้วกดยืนยันอีกครั้ง" };
  }

  try {
    const modelBytes = models.length === 1 ? models[0].bytes :
      zipSync(Object.fromEntries(models.map((model, index) => [names[index], model.bytes])));
    const id = await createPrintOrder(viewer.id, { requestId, fileName, model: modelBytes, printSettings: options, shipping: { ...shipping, method, contactName, contactPhone, note, mediaConsent: form.get("mediaConsent") === "on", useAsBilling: form.get("useAsBilling") === "on" }, quote, saveAddress });
    if (!id) return { error: "ข้อมูลสีหรือจำนวนเส้นในสต๊อกเปลี่ยน กรุณากลับไปเลือกสีอีกครั้ง" };
    notifyAfterCheckout(id);
    await notifyCustomerOrderCreated({ userId: viewer.id, orderId: id, fileName, printSettings: options, quote });
    revalidatePath("/account");
    revalidatePath("/orders");
    return { id };
  } catch {
    return { error: "บันทึกคำสั่งพิมพ์ไม่ได้ กรุณาลองอีกครั้ง" };
  }
}
