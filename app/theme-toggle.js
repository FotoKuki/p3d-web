"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { themeStorageKey } from "./theme-preference";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");

    function update() {
      let saved;
      try { saved = localStorage.getItem(themeStorageKey); } catch {}
      const theme = saved === "dark" || saved === "light" ? saved : "dark";
      document.documentElement.dataset.theme = theme;
      setDark(theme === "dark");
    }

    function sync(event) {
      if (event.key === themeStorageKey || event.key === null) update();
    }

    update();
    system.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      system.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(themeStorageKey, next); } catch {}
    document.documentElement.dataset.theme = next;
    setDark(next === "dark");
  }

  return (
    <button type="button" className="theme-toggle"
      aria-label={dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"} aria-pressed={dark}
      title={dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"} onClick={toggle}>
      <Moon className="theme-moon" size={19} aria-hidden="true" />
      <Sun className="theme-sun" size={19} aria-hidden="true" />
    </button>
  );
}