import { auth, googleEnabled, lineEnabled } from "../../auth";
import { listAvailableFilaments } from "../../lib/account-store";
import Estimator from "./estimator-entry";

export const metadata = {
  title: "ประเมินราคาพิมพ์ 3 มิติ | P3D",
  description: "เปิดไฟล์โมเดล 3 มิติ เลือกวัสดุ และดูราคาพิมพ์โดยประมาณ",
};

export default async function EstimatePage({ searchParams }) {
  const { order } = await searchParams;
  const session = googleEnabled || lineEnabled ? await auth() : null;
  return (
    <Estimator
      account={session?.user?.id ? (session.user.name || session.user.email || "บัญชี") : null}
      filaments={await listAvailableFilaments()}
      resumeOrder={order === "1"}
    />
  );
}
