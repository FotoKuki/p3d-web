"use client";

import { useActionState, useState, useTransition } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteAddress, saveAddress, saveProfile } from "./actions";
import styles from "./account.module.css";
import AddressDialog from "../address-dialog";
import { formatAddress } from "../../lib/shipping-options";

function Feedback({ result }) {
  if (!result?.message) return null;
  return <p className={result.ok ? styles.success : styles.error} role={result.ok ? "status" : "alert"}>{result.message}</p>;
}

export function ProfileForm({ profile }) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone);
  const changed = name.trim() !== (profile.name ?? "") || phone.trim() !== profile.phone;

  return (
    <form action={action} className={styles.profileForm}>
      <div className={styles.fields}>
        <label>ชื่อ-นามสกุล
          <input name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        </label>
        <label>อีเมลที่ใช้เข้าสู่ระบบ
          <input type="email" value={profile.email ?? ""} placeholder="บัญชีนี้ไม่มีอีเมล" readOnly />
        </label>
        <label>เบอร์โทรศัพท์
          <input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} />
        </label>
      </div>
      <div className={styles.formFooter}>
        <Feedback result={state} />
        <button className={styles.primary} disabled={pending || !changed}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
      </div>
    </form>
  );
}

export function ShippingAddresses({ addresses, profile }) {
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [deleting, startDelete] = useTransition();

  function openEditor(id) {
    setEditor(id);
    setNotice(null);
    setConfirm(null);
  }

  const selected = addresses.find((address) => address.id === editor);

  return (
    <section className={styles.card} id="shipping-addresses" aria-labelledby="shipping-title">
      <div className={styles.cardHeading}>
        <div><h2 id="shipping-title">ที่อยู่จัดส่ง</h2><p>จัดการที่อยู่สำหรับรับชิ้นงาน</p></div>
        <button type="button" className={styles.secondary} onClick={() => openEditor("new")} disabled={editor === "new" || deleting}><Plus size={17} aria-hidden="true" /> เพิ่มที่อยู่</button>
      </div>
      <Feedback result={notice} />
      {editor && <AddressDialog initial={selected} profile={profile} onCancel={() => setEditor(null)} onSave={async (data) => {
        const result = await saveAddress(selected?.id ?? null, null, data);
        if (!result.ok) return result.message;
        setEditor(null);
        setNotice(result);
      }} />}
      {addresses.length ? <ul className={styles.addressList}>
        {addresses.map((address) => <li key={address.id}>
          <article className={styles.addressCard}>
              <div className={styles.addressHeading}>
                <div><h3>{address.label}</h3><p>{address.recipient}</p></div>
                <div className={styles.addressActions}>
                  <button type="button" onClick={() => openEditor(address.id)} aria-label={"แก้ไขที่อยู่ " + address.label} disabled={deleting}><Pencil size={17} /></button>
                  <button type="button" onClick={() => { setConfirm(address.id); setNotice(null); }} aria-label={"ลบที่อยู่ " + address.label} disabled={deleting}><Trash2 size={17} /></button>
                </div>
              </div>
              <p className={styles.street}>{formatAddress(address)}</p>
              <p className={styles.addressMeta}>{address.phone}</p>
              {confirm === address.id && <div className={styles.deletePrompt}>
                <span>ลบที่อยู่นี้หรือไม่</span>
                <button type="button" className={styles.secondary} onClick={() => setConfirm(null)} disabled={deleting}>เก็บไว้</button>
                <button type="button" className={styles.danger} disabled={deleting} onClick={() => startDelete(async () => {
                  const result = await deleteAddress(address.id);
                  setNotice(result);
                  setConfirm(null);
                })}>{deleting ? "กำลังลบ…" : "ยืนยันการลบ"}</button>
              </div>}
            </article>
        </li>)}
      </ul> : !editor && <div className={styles.empty}><MapPin size={20} aria-hidden="true" /> ยังไม่มีที่อยู่จัดส่ง</div>}
    </section>
  );
}