"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import styles from "./orders/orders.module.css";

let placesRequest;

export default function AddressDialog({ initial, profile, onCancel, onSave, checkout = false }) {
  const popup = useRef(null);
  const [places, setPlaces] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [provinceId, setProvince] = useState(initial?.provinceId ?? "");
  const [districtId, setDistrict] = useState(initial?.districtId ?? "");
  const [subdistrictId, setSubdistrict] = useState(initial?.subdistrictId ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = popup.current;
    if (!dialog.open) dialog.showModal();
    let live = true;
    placesRequest ??= fetch("/data/thai-addresses.json").then((response) => {
      if (!response.ok) throw new Error("Address data unavailable");
      return response.json();
    }).catch((reason) => { placesRequest = null; throw reason; });
    placesRequest.then((data) => { if (live) setPlaces(data); }, () => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  const province = places?.find((place) => place.id === provinceId);
  const district = province?.districts.find((place) => place.id === districtId);
  const subdistrict = district?.subdistricts.find((place) => place.id === subdistrictId);
  const bangkok = provinceId === "10";

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const feedback = await onSave(data, { province: province.name, district: district.name, subdistrict: subdistrict.name });
      if (feedback) setError(feedback);
    } catch {
      setError("บันทึกที่อยู่ไม่ได้ กรุณาลองอีกครั้ง");
    }
    setSaving(false);
  }

  return (
    <dialog ref={popup} className={styles.checkout} aria-labelledby="shipping-dialog-title" onClose={onCancel}
      onCancel={(event) => { if (saving) event.preventDefault(); }}>
      <div className={styles.checkoutBody}>
        <div className={styles.heading}>
          <h2 id="shipping-dialog-title">{initial ? "แก้ไขที่อยู่จัดส่ง" : "เพิ่มที่อยู่จัดส่ง"}</h2>
          <button className="icon-button" type="button" aria-label="ปิดฟอร์มที่อยู่" disabled={saving} onClick={() => popup.current.close()}><X size={18} /></button>
        </div>
        <form className={styles.checkoutForm} onSubmit={submit}>
          <div className={styles.fields}>
            <input type="hidden" name="label" value={initial?.label ?? ""} />
            <label className={styles.full}>ชื่อ-นามสกุลผู้รับ<input name="recipient" autoComplete="shipping name" defaultValue={initial?.recipient ?? profile?.name ?? ""} required maxLength={120} /></label>
            <label>อีเมล<input name="email" type="email" autoComplete="shipping email" defaultValue={initial?.email ?? profile?.email ?? ""} required maxLength={254} /></label>
            <label>เบอร์โทรศัพท์<input name="phone" type="tel" autoComplete="shipping tel" defaultValue={initial?.phone ?? profile?.phone ?? ""} required maxLength={30} /></label>
            <label className={styles.full}>ที่อยู่<input name="address" autoComplete="shipping street-address" placeholder="บ้านเลขที่ ถนน ซอย หมู่บ้าน" defaultValue={initial?.address ?? ""} required maxLength={500} /></label>
            <label>จังหวัด
              <select name="provinceId" aria-label="จังหวัด" value={provinceId} required disabled={!places} onChange={(event) => {
                setProvince(event.target.value); setDistrict(""); setSubdistrict(""); setPostalCode("");
              }}>
                <option value="">{loadError ? "โหลดจังหวัดไม่สำเร็จ" : places ? "เลือกจังหวัด" : "กำลังโหลดจังหวัด…"}</option>
                {places?.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
            <label>{bangkok ? "เขต" : "อำเภอ"}
              <select name="districtId" aria-label={bangkok ? "เขต" : "อำเภอ"} value={districtId} required disabled={!province} onChange={(event) => {
                setDistrict(event.target.value); setSubdistrict(""); setPostalCode("");
              }}>
                <option value="">{bangkok ? "เลือกเขต" : "เลือกอำเภอ"}</option>
                {province?.districts.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
            <label>{bangkok ? "แขวง" : "ตำบล"}
              <select name="subdistrictId" aria-label={bangkok ? "แขวง" : "ตำบล"} value={subdistrictId} required disabled={!district} onChange={(event) => {
                const place = district.subdistricts.find((item) => item.id === event.target.value);
                setSubdistrict(event.target.value);
                setPostalCode(place?.postalCodes.length === 1 ? place.postalCodes[0] : "");
              }}>
                <option value="">{bangkok ? "เลือกแขวง" : "เลือกตำบล"}</option>
                {district?.subdistricts.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
            <label>รหัสไปรษณีย์
              <select name="postalCode" aria-label="รหัสไปรษณีย์" value={postalCode} required disabled={!subdistrict} onChange={(event) => setPostalCode(event.target.value)}>
                <option value="">เลือกรหัสไปรษณีย์</option>
                {subdistrict?.postalCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <label className={styles.full}>เลขประจำตัวผู้เสียภาษี (ไม่บังคับ)
              <input name="taxId" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} defaultValue={initial?.taxId ?? ""} />
            </label>
            {checkout && <label className={styles.checkbox}><input type="checkbox" name="saveAddress" defaultChecked={initial?.saveAddress === "on"} /> บันทึกที่อยู่นี้ไว้ในบัญชีเมื่อสั่งพิมพ์</label>}
          </div>
          {error && <p className="alert" role="alert">{error}</p>}
          {loadError && <p className="alert" role="alert">โหลดข้อมูลพื้นที่ไม่ได้ ลองปิดแล้วเปิดฟอร์มใหม่</p>}
          <button className={styles.primary} type="submit" disabled={saving || !subdistrict || !postalCode}>
            {saving ? "กำลังบันทึก…" : "บันทึกที่อยู่"}
          </button>
        </form>
      </div>
    </dialog>
  );
}
