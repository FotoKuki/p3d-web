"use server";

import { revalidatePath } from "next/cache";
import { addFilamentStock, deleteFilamentStock, updateFilamentStock } from "../../../lib/account-store";
import { orderViewer } from "../../../lib/order-access";
import { fieldText } from "../../../lib/shipping";
import { materials } from "../../pricing";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function wholeNumber(value) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

export async function saveStock(id, _previous, form) {
  if (!(await orderViewer())?.admin) return { error: "เฉพาะแอดมินที่จัดการสต๊อกได้" };
  const material = fieldText(form, "material");
  const color = fieldText(form, "color").normalize("NFC").replace(/\s+/g, " ");
  const hex = fieldText(form, "hex").toLowerCase();
  const grams = wholeNumber(fieldText(form, "grams"));
  if (!Object.hasOwn(materials, material) || !color || color.length > 60 || grams === null) {
    return { error: "เลือกวัสดุ กรอกชื่อสี และใส่น้ำหนักเป็นจำนวนเต็มกรัม" };
  }
  if ((hex || id === null) && !/^#[0-9a-f]{6}$/.test(hex)) return { error: "ใส่รหัสสี HEX 6 หลัก เช่น #457b9d" };

  const stock = { material, color, hex: hex || null, grams };
  if (id === null) {
    if (!(await addFilamentStock(stock))) return { error: "วัสดุและสีนี้มีในสต๊อกแล้ว" };
  } else {
    const revision = wholeNumber(fieldText(form, "revision"));
    if (!uuid.test(id) || revision === null || !(await updateFilamentStock(id, revision, stock))) {
      return { error: "ชื่อสีซ้ำในวัสดุนี้ หรือรายการถูกแก้ไขแล้ว กรุณาตรวจข้อมูลอีกครั้ง" };
    }
  }
  revalidatePath("/admin/stock");
  revalidatePath("/estimate");
  return { message: id === null ? "เพิ่มสีแล้ว" : "บันทึกสีแล้ว" };
}

export async function removeStock(id, _previous, form) {
  if (!(await orderViewer())?.admin) return { error: "เฉพาะแอดมินที่จัดการสต๊อกได้" };
  const revision = wholeNumber(fieldText(form, "revision"));
  if (!uuid.test(id) || revision === null || !(await deleteFilamentStock(id, revision))) {
    return { error: "รายการถูกแก้ไขแล้ว กรุณาเปิดรายการใหม่ก่อนลบ" };
  }
  revalidatePath("/admin/stock");
  revalidatePath("/estimate");
  return { message: "ลบสีออกจากสต๊อกแล้ว" };
}
