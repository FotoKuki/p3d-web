import "./globals.css";
import { initialThemeScript } from "./theme-preference";

export const metadata = {
  title: "ประเมินราคาพิมพ์ 3 มิติ | P3D",
  description: "เปิดไฟล์โมเดล 3 มิติ เลือกวัสดุ และดูราคาพิมพ์โดยประมาณ",
};

export default function Layout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: initialThemeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}