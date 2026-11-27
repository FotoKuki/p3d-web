"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import styles from "./sign-in.module.css";

function GoogleMark() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default function GoogleSignInButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.googleButton} disabled={pending}>
      {pending ? (
        <>
          <Loader2 size={19} className={styles.spinner} aria-hidden="true" />
          <span>กำลังเชื่อมต่อกับ Google...</span>
        </>
      ) : (
        <>
          <GoogleMark />
          <span>เข้าสู่ระบบด้วย Google</span>
        </>
      )}
    </button>
  );
}
