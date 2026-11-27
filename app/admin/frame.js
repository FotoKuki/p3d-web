import Link from "next/link";
import { ClipboardList, LogOut, Palette, ShieldCheck } from "lucide-react";
import BrandLink from "../brand-link";
import ThemeToggle from "../theme-toggle";
import { leaveAdmin } from "./actions";
import styles from "./admin-shell.module.css";

export default function AdminFrame({ viewer, children, active = "orders" }) {
  const adminHandle = viewer?.email ? viewer.email.split("@")[0] : "Admin";

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.left}>
            <div className={styles.brandGroup}>
              <BrandLink />
              <span className={styles.divider} aria-hidden="true" />
              <span className={styles.adminBadge}>
                <ShieldCheck size={14} aria-hidden="true" />
                หลังบ้าน P3D
              </span>
            </div>

            {viewer?.admin && (
              <nav className={styles.nav} aria-label="เมนูหลังบ้าน">
                <Link
                  href="/admin/orders"
                  className={`${styles.navLink} ${active === "orders" ? styles.navLinkActive : ""}`}
                  aria-current={active === "orders" ? "page" : undefined}
                >
                  <ClipboardList size={15} aria-hidden="true" />
                  <span>คำสั่งพิมพ์</span>
                </Link>
                <Link
                  href="/admin/stock"
                  className={`${styles.navLink} ${active === "stock" ? styles.navLinkActive : ""}`}
                  aria-current={active === "stock" ? "page" : undefined}
                >
                  <Palette size={15} aria-hidden="true" />
                  <span>สต๊อกเส้น</span>
                </Link>
              </nav>
            )}
          </div>

          <div className={styles.right}>
            <ThemeToggle />
            {viewer?.admin && (
              <>
                <span className={styles.userPill} title={viewer.email || ""}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  <span>{adminHandle}</span>
                </span>
                <form action={leaveAdmin}>
                  <button type="submit" className={styles.logoutBtn}>
                    <LogOut size={15} aria-hidden="true" />
                    <span>ออกจากระบบ</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={styles.workspace}>{children}</main>
    </div>
  );
}
