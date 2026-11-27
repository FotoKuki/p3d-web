"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountReturnPath } from "../../lib/account-return";
import { auth, googleEnabled, legacyLineEnabled, lineEnabled, signIn, signOut } from "../../auth";
import { currentLineProvider } from "../../lib/line-provider";
import { getAccountProfile, removeShippingAddress, saveShippingAddress, unlinkLineAccount, updateProfile } from "../../lib/account-store";
import { fieldText as text, shippingFromForm, validPhone } from "../../lib/shipping";

const noSession = { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
const missingAddress = { ok: false, message: "ไม่พบที่อยู่นี้ในบัญชี" };

async function currentUserId() {
  const session = await auth();
  return session?.user?.id;
}

export async function saveProfile(_previous, form) {
  const userId = await currentUserId();
  if (!userId) return noSession;
  const name = text(form, "name");
  const phone = text(form, "phone");
  if (!name || name.length > 120) return { ok: false, message: "กรอกชื่อ-นามสกุล ความยาวไม่เกิน 120 ตัวอักษร" };
  if (phone && !validPhone(phone)) return { ok: false, message: "กรอกเบอร์โทรศัพท์ให้ถูกต้อง" };

  if (!(await updateProfile(userId, { name, phone }))) return noSession;
  revalidatePath("/account");
  return { ok: true, message: "บันทึกข้อมูลส่วนตัวแล้ว" };
}

export async function saveAddress(id, _previous, form) {
  const userId = await currentUserId();
  if (!userId) return noSession;

  const { data, error } = shippingFromForm(form);
  if (error) return { ok: false, message: error };
  if (!(await saveShippingAddress(userId, id, data))) return missingAddress;
  revalidatePath("/account");
  return { ok: true, message: id ? "บันทึกการแก้ไขที่อยู่แล้ว" : "เพิ่มที่อยู่จัดส่งแล้ว" };
}

export async function deleteAddress(id) {
  const userId = await currentUserId();
  if (!userId) return noSession;
  if (!(await removeShippingAddress(userId, id))) return missingAddress;
  revalidatePath("/account");
  return { ok: true, message: "ลบที่อยู่แล้ว" };
}

export async function enterAccount(provider, next) {
  const redirectTo = accountReturnPath(next);
  const enabled = { google: googleEnabled, line: lineEnabled, "line-legacy": legacyLineEnabled };
  if (!Object.hasOwn(enabled, provider) || !enabled[provider]) redirect("/account");
  if (await currentUserId()) redirect(redirectTo);
  const authProvider = { google: "google", line: currentLineProvider, "line-legacy": "line" }[provider];
  await signIn(authProvider, { redirectTo });
}

export async function connectLine() {
  const userId = await currentUserId();
  const profile = userId && (await getAccountProfile(userId));
  if (!profile || !lineEnabled || profile.lineLinked) redirect("/account");
  await signIn(currentLineProvider, { redirectTo: "/account#line-account" });
}

export async function disconnectLine() {
  const userId = await currentUserId();
  if (userId) await unlinkLineAccount(userId);
  revalidatePath("/account");
  redirect("/account#line-account");
}

export async function leaveAccount() {
  await signOut({ redirectTo: "/account" });
}
