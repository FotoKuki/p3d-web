import Link from "next/link";
import { redirect } from "next/navigation";
import { accountReturnPath } from "../../lib/account-return";
import { CircleCheck, LogOut, MapPin, MessageCircle, UserRound } from "lucide-react";
import { auth, googleEnabled, legacyLineEnabled, lineEnabled } from "../../auth";
import { getAccountProfile, listPrintOrders } from "../../lib/account-store";
import { connectLine, disconnectLine, enterAccount, leaveAccount } from "./actions";
import { ProfileForm, ShippingAddresses } from "./forms";
import styles from "./account.module.css";
import ThemeToggle from "../theme-toggle";
import BrandLink from "../brand-link";
import { OrderList } from "../orders/order-list";
import { isAdminEmail } from "../../lib/site-role";

export const metadata = { title: "บัญชีของฉัน | P3D", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }) {
  const { error, next } = await searchParams;
  const session = googleEnabled || lineEnabled ? await auth() : null;
  const returnPath = accountReturnPath(next);
  const estimating = returnPath !== "/account";
  if (session?.user?.id && estimating) redirect(returnPath);
  const profile = session?.user?.id ? await getAccountProfile(session.user.id) : null;
  const orders = profile ? await listPrintOrders(profile.id) : [];
  const errorMessage = error === "OAuthAccountNotLinked"
    ? "บัญชีที่เลือกเชื่อมกับบัญชี P3D อื่นอยู่แล้ว กรุณาเลือกบัญชีอื่น"
    : error ? "เข้าสู่ระบบหรือเชื่อมบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง" : "";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <BrandLink />
          <div className={styles.headerActions}>
            <Link href="/orders" className={styles.headerLink}>คิวของฉัน</Link>
            <Link href="/estimate" className={styles.headerLink}>ประเมินราคา</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={styles.workspace}>
        <div className={styles.heading}>
          <div><h1>บัญชีของฉัน</h1>{profile?.email && <p>{profile.email}</p>}</div>
          {profile && <form action={leaveAccount}><button className={styles.secondary}><LogOut size={17} aria-hidden="true" /> ออกจากระบบ</button></form>}
        </div>
        {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
        {profile ? (
          <div className={styles.layout}>
            <nav className={styles.sidebar} aria-label="เมนูบัญชี">
              <a href="#personal-info"><UserRound size={17} aria-hidden="true" /> ข้อมูลส่วนตัว</a>
              <a href="#shipping-addresses"><MapPin size={17} aria-hidden="true" /> ที่อยู่จัดส่ง <span>{profile.addresses.length}</span></a>
              <a href="#orders">คำสั่งพิมพ์</a>
              <a href="#line-account"><MessageCircle size={17} aria-hidden="true" /> บัญชี LINE</a>
            </nav>
            <div className={styles.content}>
              <section className={styles.card} id="personal-info" aria-labelledby="profile-title">
                <div className={styles.cardHeading}><div><h2 id="profile-title">ข้อมูลส่วนตัว</h2><p>ข้อมูลติดต่อสำหรับงานพิมพ์ของคุณ</p></div></div>
                <ProfileForm profile={{ name: profile.name, email: profile.email, phone: profile.phone }} />
              </section>
              <ShippingAddresses addresses={profile.addresses} profile={{ name: profile.name, email: profile.email, phone: profile.phone }} />
              <section className={styles.card} id="orders" aria-labelledby="orders-title">
                <div className={styles.cardHeading}><h2 id="orders-title">คำสั่งพิมพ์ของฉัน</h2>
                  <Link className={styles.secondary} href="/orders">ติดตามคำสั่งพิมพ์</Link>
                  {session.user.verifiedGoogleSignIn && isAdminEmail(profile.email) && <Link className={styles.secondary} href="/admin/orders">คำสั่งพิมพ์ของร้าน</Link>}
                </div>
                <OrderList orders={orders} />
              </section>
              <section className={styles.card} id="line-account" aria-labelledby="line-title">
                <div className={styles.cardHeading}><div><h2 id="line-title">บัญชี LINE</h2><p>{profile.lineLinked
                  ? "ตอบกลับในแชท LINE OA ของ P3D เพื่อให้แอดมินติดต่อเรื่องงานพิมพ์ได้"
                  : "เพิ่ม LINE OA ของ P3D เป็นเพื่อนตอนเชื่อมบัญชี เพื่อรับข้อความจากร้านและแจ้งเตือนงานพิมพ์"}</p></div></div>
                {profile.lineLinked ? (
                  <div className={styles.cardHeading} style={{ marginBottom: 0 }}>
                    <p className={styles.linked}><CircleCheck size={18} aria-hidden="true" /> เชื่อมต่อ LINE แล้ว</p>
                    {profile.canUnlinkLine && (
                      <form action={disconnectLine}>
                        <button type="submit" className={styles.secondary}>ยกเลิกการเชื่อมต่อ</button>
                      </form>
                    )}
                  </div>
                ) : lineEnabled ? (
                  <form action={connectLine}><button className={styles.lineButton}><MessageCircle size={18} aria-hidden="true" /> {profile.legacyLineLinked ? "เชื่อม LINE ใหม่กับบัญชีเดิม" : "เชื่อมต่อ LINE"}</button></form>
                ) : <p className={styles.configNote}>กำลังรอผู้ดูแลเว็บเปิดใช้งาน LINE Login</p>}
              </section>
            </div>
          </div>
        ) : (
          <section className={styles.signInCard}>
            <div className={styles.signInIcon}><UserRound size={24} aria-hidden="true" /></div>
            <h2>{estimating ? "เข้าสู่ระบบเพื่อใช้งาน" : "เข้าสู่ระบบเพื่อจัดการบัญชี"}</h2>
            <p>{estimating ? "เลือก Google หรือ LINE เพื่อบันทึกข้อมูลและดำเนินการต่อ" : "เข้าสู่ระบบเพื่อบันทึกข้อมูลติดต่อ ที่อยู่จัดส่ง และติดตามคิวงาน"}</p>
            {googleEnabled && (
              <form action={enterAccount.bind(null, "google", next)}>
                <button className={styles.googleBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z" />
                    <path fill="#FBBC05" d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l4-3.09Z" />
                    <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Google</span>
                </button>
              </form>
            )}
            {lineEnabled && (
              <form action={enterAccount.bind(null, "line", next)}>
                <button className={styles.lineButton}>
                  <MessageCircle size={18} aria-hidden="true" />
                  <span>เข้าสู่ระบบด้วย LINE</span>
                </button>
              </form>
            )}
            {legacyLineEnabled && (
              <form action={enterAccount.bind(null, "line-legacy", undefined)}>
                <p>เคยใช้ LINE กับ P3D แล้ว ให้เข้าด้วย LINE เดิมก่อนเพื่อดูออเดอร์และเชื่อมบัญชีอีกครั้ง</p>
                <button className={styles.secondary}>เข้าสู่ระบบด้วย LINE เดิม</button>
              </form>
            )}
            {!googleEnabled && !lineEnabled && <p className={styles.configNote}>กำลังรอผู้ดูแลเว็บเปิดใช้งาน OAuth</p>}
          </section>
        )}
      </main>
      <footer className={styles.pageFooter}>© {new Date().getFullYear()} P3D Printing and Design</footer>
    </>
  );
}
