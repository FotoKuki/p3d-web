"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { colorOptions } from "../../../lib/print-options";
import { removeStock, saveStock } from "./actions";
import layout from "../../orders/orders.module.css";
import styles from "./stock.module.css";

const format = new Intl.NumberFormat("th-TH");
const hexPattern = /^#[0-9a-f]{6}$/i;

function knownHex(row) {
  return row?.hex ?? colorOptions.find(({ label }) => label === row?.color)?.value;
}

function StockEditor({ materials, row, deleting, finish, close }) {
  const [material, setMaterial] = useState(row?.material ?? materials[0]);
  const [color, setColor] = useState(row?.color ?? "");
  const [hex, setHex] = useState(knownHex(row) ?? (row ? "" : "#808080"));
  const [grams, setGrams] = useState(row?.grams ?? "");
  const change = deleting ? removeStock : saveStock;
  const [result, action, pending] = useActionState(change.bind(null, row?.id ?? null), null);

  useEffect(() => {
    if (result?.message) finish(result.message);
  }, [result, finish]);

  return <form action={action} className={layout.checkoutForm}>
    {row && <input type="hidden" name="revision" value={row.revision} />}
    {deleting ? <p>ลบสี <strong>{row.color}</strong> ออกจากสต๊อก <strong>{row.material}</strong> หรือไม่</p> : <>
      <label>ชนิดเส้น
        <select name="material" value={material} onChange={(event) => setMaterial(event.target.value)} required>
          {materials.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>ชื่อสี
        <input name="color" value={color} list="filament-colors" placeholder="เช่น ขาวด้าน" maxLength={60} required
          onChange={(event) => {
            const name = event.target.value;
            setColor(name);
            const preset = colorOptions.find(({ label }) => label === name);
            if (preset) setHex(preset.value);
          }} />
        <datalist id="filament-colors">{colorOptions.map(({ label }) => <option value={label} key={label} />)}</datalist>
      </label>
      <div className={styles.colorInputs}>
        <label>เลือกสี
          <input type="color" value={hexPattern.test(hex) ? hex : "#808080"} onChange={(event) => setHex(event.target.value)} />
        </label>
        <label>รหัสสี HEX
          <input name="hex" value={hex} onChange={(event) => setHex(event.target.value)}
            pattern="#[0-9A-Fa-f]{6}" maxLength={7} placeholder="#457b9d" spellCheck={false} required={!row} />
        </label>
      </div>
      <label>คงเหลือ (กรัม)
        <input name="grams" type="number" inputMode="numeric" min="0" step="1" placeholder="1000" required
          value={grams} onChange={(event) => setGrams(event.target.value)} />
      </label>
    </>}
    {result?.error && <p className="alert compact" role="alert">{result.error}</p>}
    <div className={styles.dialogActions}>
      <button type="button" className={layout.secondaryButton} onClick={close}>ยกเลิก</button>
      <button className={deleting ? styles.deleteButton : layout.primary} disabled={pending}>
        {pending ? "กำลังบันทึก…" : deleting ? "ยืนยันลบสี" : "บันทึกสี"}
      </button>
    </div>
  </form>;
}

export default function StockBoard({ stock, materials }) {
  const [selection, setSelection] = useState(null);
  const [feedback, setFeedback] = useState("");
  const dialog = useRef(null);
  const addButton = useRef(null);

  useEffect(() => {
    if (selection && !dialog.current.open) dialog.current.showModal();
  }, [selection]);

  function open(mode, row) {
    setFeedback("");
    setSelection({ mode, row });
  }

  const close = useCallback(() => {
    dialog.current.close();
  }, []);

  const finish = useCallback((message) => {
    setFeedback(message);
    close();
    if (selection?.mode === "delete") addButton.current?.focus();
  }, [close, selection?.mode]);

  return <>
    <div className={styles.header}>
      <h1>จัดการวัสดุและสี</h1>
      <button type="button" ref={addButton} className={layout.primary} onClick={() => open("add")}>
        <Plus size={16} aria-hidden="true" /> เพิ่มสีใหม่
      </button>
    </div>
    {feedback && <p className={layout.success} role="status">{feedback}</p>}
    <div className={styles.groups}>
      {materials.map((material) => {
        const rows = stock.filter((row) => row.material === material);
        return <section key={material} aria-label={material}>
          <div className={styles.groupHead}><h2>{material}</h2><span>{rows.length} สี</span></div>
          {rows.length ? <ul className={styles.cards}>
            {rows.map((row) => {
              const hex = knownHex(row);
              return <li className={styles.card} key={row.id}>
                <div className={styles.cardTop}>
                  <span className={styles.swatch} style={hex ? { backgroundColor: hex } : undefined} aria-hidden="true" />
                  <div className={styles.colorInfo}><strong>{row.color}</strong><span>{hex ?? "ยังไม่ระบุ HEX"}</span></div>
                </div>
                <div className={styles.cardBottom}>
                  <span className={row.grams > 0 ? styles.available : styles.out}>{row.grams > 0 ? "ใช้ได้" : "หมดสต๊อก"}</span>
                  <span className={styles.weight}>{format.format(row.grams)} กรัม</span>
                </div>
                <div className={styles.cardActions}>
                  <button type="button" onClick={() => open("edit", row)} aria-label={"แก้ไข " + material + " " + row.color}><Pencil size={15} /></button>
                  <button type="button" onClick={() => open("delete", row)} aria-label={"ลบ " + material + " " + row.color}><Trash2 size={15} /></button>
                </div>
              </li>;
            })}
          </ul> : <p className={styles.empty}>ยังไม่มีสี</p>}
        </section>;
      })}
    </div>
    <dialog className={styles.dialog} ref={dialog} aria-labelledby="stock-dialog-title" onClose={() => setSelection(null)}>
      {selection && <div className={styles.dialogBody}>
        <div className={styles.dialogHeader}>
          <h2 id="stock-dialog-title">{selection.mode === "delete" ? "ลบสี" : selection.mode === "edit" ? "แก้ไขสี" : "เพิ่มสีใหม่"}</h2>
          <button type="button" className="icon-button" aria-label="ปิด" onClick={close}><X size={18} /></button>
        </div>
        <StockEditor row={selection.row} deleting={selection.mode === "delete"} materials={materials} finish={finish} close={close} />
      </div>}
    </dialog>
  </>;
}
