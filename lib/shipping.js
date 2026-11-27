import thailand from "../public/data/thai-addresses.json";

export function fieldText(form, key) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function validPhone(value) {
  return /^\+?\d[\d\s()-]*$/.test(value) && value.length <= 30 && /^\d{8,15}$/.test(value.replace(/\D/g, ""));
}

export function shippingFromForm(form) {
  const data = Object.fromEntries(["label", "recipient", "email", "phone", "address", "postalCode", "taxId", "provinceId", "districtId", "subdistrictId"]
    .map((key) => [key, fieldText(form, key)]));
  data.label ||= "ที่อยู่จัดส่ง";
  if (data.label.length > 60 || !data.recipient || data.recipient.length > 120 || !data.address || data.address.length > 500) {
    return { error: "กรอกชื่อผู้รับและรายละเอียดที่อยู่ให้ครบ" };
  }
  if (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !validPhone(data.phone)) {
    return { error: "ตรวจอีเมลและเบอร์โทรศัพท์ของผู้รับ" };
  }
  if (data.taxId && !/^\d{13}$/.test(data.taxId)) return { error: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก" };

  const province = thailand.find((place) => place.id === data.provinceId);
  const district = province?.districts.find((place) => place.id === data.districtId);
  const subdistrict = district?.subdistricts.find((place) => place.id === data.subdistrictId);
  if (!subdistrict || !subdistrict.postalCodes.includes(data.postalCode)) {
    return { error: "เลือกจังหวัด อำเภอ ตำบล และรหัสไปรษณีย์ให้ตรงกัน" };
  }
  return { data: { ...data, province: province.name, district: district.name, subdistrict: subdistrict.name } };
}
