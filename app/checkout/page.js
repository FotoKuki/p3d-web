import Link from "next/link";
import BrandLink from "../brand-link";
import ThemeToggle from "../theme-toggle";
import { auth, googleEnabled, lineEnabled } from "../../auth";
import { currentLineProvider } from "../../lib/line-provider";
import { getAccountProfile } from "../../lib/account-store";
import CheckoutForm from "./form";
import styles from "../orders/orders.module.css";

export const metadata = { title: "ชำระเงิน | P3D", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const session = googleEnabled || lineEnabled ? await auth() : null;
  const profile = session?.user?.id && (await getAccountProfile(session.user.id));
  return (
    <>
      <header className="topbar"><div className="topbar-inner">
        <BrandLink /><ThemeToggle />
      </div></header>
      <main className={styles.checkoutWorkspace}>
        <Link className={styles.headerActionsLink} href="/estimate?order=1">กลับไปประเมินราคา</Link>
        <h1>ชำระเงิน</h1>
        <CheckoutForm profile={profile ? { name: profile.name, email: profile.email, phone: profile.phone, addresses: profile.addresses } : null}
          googleEnabled={googleEnabled} lineEnabled={lineEnabled} lineProvider={currentLineProvider} />
      </main>
    </>
  );
}
