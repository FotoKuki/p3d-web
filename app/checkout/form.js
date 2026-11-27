"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Mesh, Quaternion } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { Plus, Pencil } from "lucide-react";
import { formatAddress, shippingMethods } from "../../lib/shipping-options";
import { readOrderDraft, clearOrderDraft } from "../order-draft";
import AddressDialog from "../address-dialog";
import { readModel } from "../model";
import { isValidModelScale, originalScale, scaleModel } from "../model-scale";
import { measurePlacement, plateCenter } from "../placement";
import { submitPrintOrder } from "../orders/actions";
import styles from "../orders/orders.module.css";

const amounts = new Intl.NumberFormat("th-TH");

export default function CheckoutForm({ profile, googleEnabled, lineEnabled, lineProvider }) {
  const router = useRouter();
  const modelFile = useRef(null);
  const [draft, setDraft] = useState(undefined);
  const [method, setMethod] = useState("postal");
  const [addressId, setAddressId] = useState(profile?.addresses[0]?.id ?? "");
  const [newAddress, setNewAddress] = useState(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [revisedTotal, setRevisedTotal] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    readOrderDraft().then((value) => { if (live) setDraft(value); }, () => { if (live) setDraft(null); });
    return () => { live = false; };
  }, []);

  if (draft === undefined) return <p role="status">กำลังเปิดคำสั่งพิมพ์…</p>;
  if (!draft) return <p>ยังไม่มีไฟล์สำหรับสั่งพิมพ์ <Link href="/estimate">เลือกไฟล์ในหน้าประเมินราคา</Link></p>;

  const shippingFee = shippingMethods[method].fee;
  const total = revisedTotal ?? draft.quote.total - draft.quote.shipping + shippingFee;

  async function login(provider) {
    setPending(true);
    setError("");
    try {
      const response = await signIn(provider, { redirect: false, redirectTo: "/checkout" });
      if (!response?.ok || !response.url) throw new Error();
      window.location.assign(response.url);
    } catch {
      setError("เปิดหน้าเข้าสู่ระบบไม่ได้ กรุณาลองอีกครั้ง");
      setPending(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    if (pending) return;
    if (!addressId) { setError("เลือกหรือเพิ่มที่อยู่จัดส่งก่อนยืนยัน"); return; }
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (draft.plateFiles?.length || draft.parts?.length > 1) modelFile.current = draft.file;
      if (!modelFile.current) {
        const original = await readModel(draft.file);
        let model = original;
        try {
          const scale = draft.scale ?? originalScale;
          if (!isValidModelScale(original, scale)) throw new Error("Invalid draft scale");
          model = scaleModel(original, scale);
          const orientation = new Quaternion().fromArray(draft.orientation).normalize();
          const placement = measurePlacement(model, orientation);
          const position = draft.position ?? plateCenter;
          if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
            throw new Error("Invalid draft position");
          }
          const mesh = new Mesh(model.geometry, null);
          mesh.position.copy(placement.offset);
          mesh.position.x += position[0];
          mesh.position.y += position[1];
          mesh.position.z += position[2];
          mesh.quaternion.copy(orientation);
          mesh.updateMatrixWorld(true);
          const binary = new STLExporter().parse(mesh, { binary: true });
          modelFile.current = new File([binary.buffer], "model.stl", { type: "model/stl" });
        } finally {
          model.geometry.dispose();
          if (model !== original) original.geometry.dispose();
        }
      }
      if (addressId === "new") {
        for (const [key, value] of Object.entries(newAddress)) data.set(key, value);
      } else {
        data.set("addressId", addressId);
      }
      data.set("requestId", draft.requestId);
      if (draft.plateFiles?.length) {
        for (const file of draft.plateFiles) data.append("model", file);
      } else data.set("model", modelFile.current);
      data.set("fileName", draft.file.name);
      data.set("expectedTotal", String(total));
      for (const [key, value] of Object.entries(draft.printSettings)) data.set(key, String(value));

      const result = await submitPrintOrder(data);
      if (result.id) {
        await clearOrderDraft().catch(() => {});
        router.push("/orders/" + result.id);
        return;
      }
      if (result.quoteTotal !== undefined) setRevisedTotal(result.quoteTotal);
      setError(result.error);
    } catch {
      setError("ส่งคำสั่งพิมพ์ไม่ได้ กรุณาลองอีกครั้ง");
    }
    setPending(false);
  }

  if (!profile) {
    return <section className={styles.card}>
      <h2>เข้าสู่ระบบเพื่อสั่งพิมพ์</h2>
      <p>ไฟล์และค่าพิมพ์จะเก็บไว้ในเบราว์เซอร์ระหว่างเข้าสู่ระบบ</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className={styles.headerActions}>
        {googleEnabled && <button className={styles.primary} type="button" disabled={pending} onClick={() => login("google")}>เข้าสู่ระบบด้วย Google</button>}
        {lineEnabled && <button className={styles.primary} type="button" disabled={pending} onClick={() => login(lineProvider)}>เข้าสู่ระบบด้วย LINE</button>}
      </div>
      {!googleEnabled && !lineEnabled && <p>ผู้ดูแลเว็บยังไม่ได้เปิดการเข้าสู่ระบบ</p>}
    </section>;
  }

  const addresses = [...profile.addresses, ...(newAddress ? [{ ...newAddress, id: "new" }] : [])];
  return (
    <>
      <p className={styles.muted}>{draft.file.name} · {draft.printSettings.material}{draft.printSettings.colorLabel && ` · ${draft.printSettings.colorLabel}`} · {draft.printSettings.quantity} ชุด</p>
      <form className={styles.checkoutForm} onSubmit={send}>
        <section className={styles.checkoutSection}>
          <div className={styles.fields}>
            <label>ชื่อ-นามสกุลผู้สั่ง<input name="contactName" autoComplete="name" defaultValue={profile.name ?? ""} required maxLength={120} /></label>
            <label>เบอร์โทรศัพท์ผู้สั่ง<input name="contactPhone" type="tel" autoComplete="tel" defaultValue={profile.phone} required maxLength={30} /></label>
            <label className={styles.full}>หมายเหตุ<textarea name="note" rows={3} placeholder="ฝากข้อความถึงร้าน" maxLength={500} /></label>
            <label className={styles.checkbox}><input type="checkbox" name="mediaConsent" /> ยินยอมให้บันทึกและเผยแพร่กระบวนการผลิตของคำสั่งพิมพ์นี้</label>
          </div>
        </section>
        <section className={styles.checkoutSection} aria-labelledby="delivery-title">
          <h2 id="delivery-title">ข้อมูลการจัดส่ง</h2>
          <fieldset className={styles.deliveryOptions}>
            <legend>วิธีจัดส่ง</legend>
            {Object.entries(shippingMethods).map(([id, option]) => (
              <label key={id}>
                <input type="radio" name="method" value={id} checked={method === id} onChange={() => { setMethod(id); setRevisedTotal(null); }} />
                <span><strong>{option.name}</strong><small>{id === "postal" ? "ค่าจัดส่ง " + option.fee + " บาท" : "ชำระค่าจัดส่งปลายทางแยกจากยอดพิมพ์"}</small></span>
              </label>
            ))}
          </fieldset>
          <div className={styles.heading}>
            <h3>ที่อยู่จัดส่ง</h3>
            <label className={styles.inlineCheckbox}><input type="checkbox" name="useAsBilling" /> ใช้ที่อยู่นี้สำหรับออกบิลด้วย</label>
          </div>
          <button type="button" className={styles.addAddress} onClick={() => setAddressOpen("add")}><Plus size={17} /> เพิ่มที่อยู่จัดส่ง</button>
          <div className={styles.addressOptions}>
            {addresses.map((address) => (
              <div key={address.id} className={styles.addressOption}>
                <label>
                  <input type="radio" name="shippingSelection" value={address.id} checked={addressId === address.id} onChange={() => setAddressId(address.id)} />
                  <span><strong>{address.recipient}</strong><span>{formatAddress(address)}</span><small>{address.phone}</small></span>
                </label>
                {address.id === "new" && <button type="button" className="icon-button" aria-label="แก้ไขที่อยู่ใหม่" onClick={() => setAddressOpen("edit")}><Pencil size={16} /></button>}
              </div>
            ))}
          </div>
        </section>
        <section className={styles.checkoutSection} aria-labelledby="checkout-total">
          <h2 id="checkout-total">ยอดชำระ</h2>
          <p className={styles.muted}>ค่าพิมพ์รวมดำเนินการ ฿{amounts.format(total - shippingFee)}</p>
          <p className={styles.muted}>{method === "postal" ? "รวมค่าจัดส่งไปรษณีย์ ฿" + amounts.format(shippingFee) : "ชำระค่าจัดส่ง LALAMOVE ปลายทางแยกต่างหาก"}</p>
          <div className={styles.checkoutTotal}><span>ยอดจ่ายผ่าน PromptPay</span><strong>฿{amounts.format(total)}</strong></div>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className={styles.primary} type="submit" disabled={pending || !addressId}>{pending ? "กำลังบันทึก…" : "ยืนยันคำสั่งพิมพ์และไปชำระเงิน"}</button>
        </section>
      </form>
      {addressOpen && <AddressDialog checkout initial={addressOpen === "edit" ? newAddress : null} profile={profile}
        onCancel={() => setAddressOpen(false)} onSave={(values, location) => {
          setNewAddress({ ...Object.fromEntries(values), ...location });
          setAddressId("new");
          setAddressOpen(false);
        }} />}
    </>
  );
}
