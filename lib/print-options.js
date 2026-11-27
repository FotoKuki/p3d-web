export const infillOptions = [5, 10, 20, 40, 60, 80, 100];
export const layerOptions = [
  { value: 0.1, label: "Ultra Fine", detail: "0.10 มม." },
  { value: 0.15, label: "Fine", detail: "0.15 มม." },
  { value: 0.2, label: "Standard", detail: "0.20 มม." },
  { value: 0.25, label: "Fast", detail: "0.25 มม." },
  { value: 0.3, label: "Draft", detail: "0.30 มม." },
];
export const wallOptions = [
  { value: 2, label: "2", detail: "มาตรฐาน" },
  { value: 3, label: "3", detail: "แข็งแรง" },
  { value: 4, label: "4", detail: "แข็งแรงมาก" },
];
export const colorOptions = [
  { value: "#457b9d", label: "ฟ้าหม่น" },
  { value: "#e0ddc2", label: "ครีม" },
  { value: "#ebb8f6", label: "ม่วงอ่อน" },
  { value: "#edffa8", label: "เหลืองอ่อน" },
  { value: "#8dd2ee", label: "ฟ้าอ่อน" },
  { value: "#ba8a15", label: "เหลืองมัสตาร์ด" },
  { value: "#0e53d4", label: "น้ำเงิน" },
];

export function filamentSwatch(color, hex) {
  return hex || colorOptions.find((option) => option.label === color)?.value || "#808080";
}
