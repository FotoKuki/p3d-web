import { notFound, redirect } from "next/navigation";
import { AlertCircle, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import { googleEnabled } from "../../../auth";
import { orderViewer } from "../../../lib/order-access";
import { isAdminSite } from "../../../lib/site-role";
import { enterAdmin } from "../actions";
import BrandLink from "../../brand-link";
import ThemeToggle from "../../theme-toggle";
import GoogleSignInButton from "./google-button";
import styles from "./sign-in.module.css";

export const metadata = {
  title: "เข้าสู่ระบบหลังบ้าน | P3D",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminSignIn({ searchParams }) {
  if (!isAdminSite()) notFound();
  const viewer = await orderViewer();
  if (viewer?.admin) redirect("/admin/orders");
  const { error } = await searchParams;
  const configured = googleEnabled && Boolean(process.env.P3D_ADMIN_EMAILS?.trim());

  return (
    <div className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brandGroup}>
            <BrandLink />
            <span className={styles.brandDivider} aria-hidden="true" />
            <span className={styles.adminBadge}>
              <ShieldCheck size={14} aria-hidden="true" />
              หลังบ้าน P3D
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.stage}>
        <div className={styles.container}>
          <section className={styles.card} aria-labelledby="admin-signin-title">
            <div className={styles.cardHeader}>
              <div className={styles.iconBadge} aria-hidden="true">
                <LockKeyhole size={24} />
              </div>
              <p className={styles.eyebrow}>P3D Admin Portal</p>
              <h1 id="admin-signin-title" className={styles.title}>
                เข้าสู่ระบบหลังบ้าน
              </h1>
              <p className={styles.subtitle}>
                สำหรับผู้ดูแลร้าน P3D เพื่อตรวจสอบและจัดการคำสั่งพิมพ์ 3 มิติ
              </p>
            </div>

            {error && (
              <div className={styles.alert} role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>เข้าสู่ระบบไม่สำเร็จ กรุณาใช้บัญชี Google ที่ได้รับสิทธิ์แอดมิน</span>
              </div>
            )}

            {configured ? (
              <form action={enterAdmin} className={styles.form}>
                <GoogleSignInButton />
              </form>
            ) : (
              <p className={styles.unconfigured}>
                <Info size={18} aria-hidden="true" />
                <span>กำลังรอการตั้งค่าบัญชีแอดมินหรือ Google Login</span>
              </p>
            )}

            <div className={styles.divider} aria-hidden="true" />

            <p className={styles.securityNote}>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>จำกัดสิทธิ์เฉพาะอีเมลแอดมินที่ลงทะเบียนในระบบเท่านั้น</span>
            </p>
          </section>

          <p className={styles.footer}>P3D 3D Printing Studio • ระบบจัดการหลังบ้าน</p>
        </div>
      </main>
    </div>
  );
}
