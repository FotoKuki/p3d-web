export const shopLineChatUrl = "https://line.me/R/oaMessage/%40839glchj";

export const shippingMethods = {
  postal: { name: "ไปรษณีย์", fee: 45 },
  lalamove: { name: "LALAMOVE", fee: 0 },
};

function withTitle(name, title) {
  return name && (name.startsWith(title) ? name : title + name);
}

export function formatAddress(address) {
  const bangkok = address.provinceId === "10";
  return [
    address.address,
    withTitle(address.subdistrict, bangkok ? "แขวง" : "ตำบล"),
    withTitle(address.district, bangkok ? "เขต" : "อำเภอ"),
    address.province,
    address.postalCode,
  ].filter(Boolean).join(" ");
}
