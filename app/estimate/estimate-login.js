"use client";

import { ArrowRight, Layers3, LockKeyhole, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { enterAccount } from "../account/actions";
import BrandLink from "../brand-link";

function ProviderButton({ provider, next }) {
  const google = provider === "google";
  return (
    <form action={enterAccount.bind(null, provider, next)}>
      <ProviderSubmit google={google} />
    </form>
  );
}

function ProviderSubmit({ google }) {
  const { pending } = useFormStatus();
  const name = google ? "Google" : "LINE";
  return (
    <button type="submit" className="provider" disabled={pending}>
      <b aria-hidden="true" className={google ? "google-mark" : "line-mark"}>{google ? "G" : "LINE"}</b>
      <span>{pending ? "กำลังเปิด " + name + "…" : "เข้าสู่ระบบด้วย " + name}</span>
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

export default function EstimateLogin({ googleEnabled, lineEnabled, next }) {
  const dialog = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const panel = dialog.current;
    if (!panel.open) panel.showModal();
    return () => { if (panel.open) panel.close(); };
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner estimate-header"><BrandLink /></div>
      </header>
      <main className="workspace estimate-workspace estimate-login">
        <section className="intro"><h1>ประเมินราคาพิมพ์ 3 มิติ</h1></section>
        <div className="viewport estimate-login-preview" aria-hidden="true">
          <div className="estimate-login-plate-label"><Layers3 size={16} /> เพลตพิมพ์ 3 มิติ</div>
          <div className="estimate-login-plate" />
        </div>
        <dialog className="estimate-login-dialog" ref={dialog} aria-labelledby="estimate-login-title"
          aria-describedby="estimate-login-description" onCancel={event => {
            event.preventDefault();
            router.replace("/");
          }}>
          <div className="dialog-content">
            <Link href="/" className="icon-button close" aria-label="ปิดและกลับหน้าแรก"><X size={19} aria-hidden="true" /></Link>
            <div className="dialog-icon"><LockKeyhole size={21} aria-hidden="true" /></div>
            <h2 id="estimate-login-title">เข้าสู่ระบบก่อนประเมินราคา</h2>
            <p id="estimate-login-description">เลือกบัญชีเพื่อเริ่มอัปโหลดและจัดวางชิ้นงาน</p>
            {googleEnabled && <ProviderButton provider="google" next={next} />}
            {lineEnabled && <ProviderButton provider="line" next={next} />}
            {!googleEnabled && !lineEnabled && <p className="dialog-note">ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน</p>}
          </div>
        </dialog>
      </main>
    </>
  );
}
