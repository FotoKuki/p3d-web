"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./home.module.css";

const categories = [
  { value: "all", label: "ทั้งหมด" },
  { value: "design", label: "ออกแบบ 3 มิติ" },
  { value: "print", label: "งานพิมพ์ 3 มิติ" },
];

const categoryLabels = {
  design: "ออกแบบ 3 มิติ",
  print: "งานพิมพ์ 3 มิติ",
};

function Popup({ dialog, labelId, className, onKeyDown, onClose, children }) {
  return (
    <dialog ref={dialog} data-home-dialog="" aria-labelledby={labelId} className={styles.popup + " " + className}
      onKeyDown={onKeyDown} onClose={onClose} onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current.close();
      }}>
      <div className={styles.popupContent}>{children}</div>
    </dialog>
  );
}

function ClosePopup({ dialog }) {
  return <button type="button" className={styles.popupButton} aria-label="ปิดป๊อปอัป" autoFocus
    onClick={() => dialog.current.close()}><X size={20} aria-hidden="true" /></button>;
}

export function WorkGallery({ projects }) {
  const [category, setCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const dialog = useRef(null);
  const opener = useRef(null);
  const filtered = category === "all" ? projects : projects.filter((project) => project.category === category);
  const active = filtered[index] ?? filtered[0];

  function changeImage(direction) {
    setIndex((current) => (current + direction + filtered.length) % filtered.length);
  }

  function open(event, next) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.current?.showModal) return;
    event.preventDefault();
    opener.current = event.currentTarget;
    setIndex(next);
    dialog.current.showModal();
  }

  function keyNavigation(event) {
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (direction) {
      event.preventDefault();
      changeImage(direction);
    }
  }

  return (
    <>
      <div className={styles.galleryFilters} role="group" aria-label="ประเภทผลงาน">
        {categories.map((item) => <button type="button" key={item.value} aria-pressed={category === item.value}
          onClick={() => { setCategory(item.value); setIndex(0); }}>{item.label}</button>)}
      </div>
      <ul className={styles.workGrid} key={category}>
        {filtered.map((project, next) => (
          <li key={project.image}>
            <figure>
              <a className={styles.workPhoto} href={"/workshop/" + project.image} aria-label={"เปิดภาพ " + project.title}
                aria-haspopup="dialog" onClick={(event) => open(event, next)}>
                <Image src={"/workshop/" + project.image} alt={project.alt} fill sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw" />
                {categoryLabels[project.category] && (
                  <span className={`${styles.workBadge} ${project.category === "design" ? styles.workBadgeDesign : styles.workBadgePrint}`}>
                    {categoryLabels[project.category]}
                  </span>
                )}
              </a>
              <figcaption>{project.title}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <Popup dialog={dialog} labelId="gallery-popup-title" className={styles.galleryPopup} onKeyDown={keyNavigation}
        onClose={() => opener.current?.focus()}>
        <div className={styles.popupHeader}>
          <h3 id="gallery-popup-title" aria-live="polite">{active.title}</h3>
          <ClosePopup dialog={dialog} />
        </div>
        <div className={styles.popupPhoto}>
          <Image key={active.image} src={"/workshop/" + active.image} alt={active.alt} width={active.width} height={active.height} priority quality={80} sizes="(max-width: 920px) 94vw, 860px" />
        </div>
        {filtered.length > 1 && <div className={styles.galleryControls}>
          <button type="button" className={styles.popupButton} aria-label="รูปก่อนหน้า" onClick={() => changeImage(-1)}><ChevronLeft aria-hidden="true" size={20} /></button>
          <span>{index + 1} / {filtered.length}</span>
          <button type="button" className={styles.popupButton} aria-label="รูปถัดไป" onClick={() => changeImage(1)}><ChevronRight aria-hidden="true" size={20} /></button>
        </div>}
      </Popup>
    </>
  );
}

export function ContactPopup({ children }) {
  const dialog = useRef(null);
  const opener = useRef(null);

  return (
    <>
      <a className={styles.contactLink} href="#contact" aria-haspopup="dialog" onClick={(event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.current?.showModal) return;
        event.preventDefault();
        opener.current = event.currentTarget;
        dialog.current.showModal();
      }}>สอบถามงาน</a>
      <Popup dialog={dialog} labelId="contact-popup-title" className={styles.contactPopup} onClose={() => opener.current?.focus()}>
        <div className={styles.popupHeader}><h2 id="contact-popup-title">ติดต่อ P3D</h2><ClosePopup dialog={dialog} /></div>
        {children}
      </Popup>
    </>
  );
}

export function ScrollMotion() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.revealed = "true";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    document.querySelectorAll("[data-home-reveal]").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return null;
}
