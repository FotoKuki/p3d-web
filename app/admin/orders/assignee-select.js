"use client";

import { useEffect, useState, useTransition } from "react";
import { assignOrderCaretaker } from "../actions";
import { orderAssignees } from "../../../lib/order-progress";
import styles from "./admin-orders.module.css";

export default function AssigneeSelect({ orderId, value = "", onAssigned, compact = true }) {
  const [current, setCurrent] = useState(value || "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCurrent(value || "");
  }, [value]);

  const handleSelect = (name) => {
    const next = current === name ? "" : name;
    const prev = current;
    setCurrent(next);
    onAssigned?.(orderId, next);

    startTransition(async () => {
      const result = await assignOrderCaretaker(orderId, next);
      if (!result?.ok) {
        setCurrent(prev);
        onAssigned?.(orderId, prev);
      }
    });
  };

  return (
    <div
      className={`${styles.assigneeToggle} ${compact ? "" : styles.assigneeToggleLarge}`}
      role="group"
      aria-label="เลือกผู้ดูแลคิว"
    >
      {orderAssignees.map((name) => {
        const active = current === name;
        const tone = name === "โต้" ? styles.assigneeBtnTo : styles.assigneeBtnPhum;
        return (
          <button
            key={name}
            type="button"
            disabled={pending}
            aria-pressed={active}
            onClick={() => handleSelect(name)}
            title={active ? `ยกเลิกผู้ดูแล (${name})` : `มอบหมายให้ ${name}`}
            className={`${styles.assigneeBtn} ${active ? `${styles.assigneeBtnActive} ${tone}` : ""}`}
          >
            <span className={styles.assigneeAvatar} aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
