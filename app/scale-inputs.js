"use client";

import { useState } from "react";
import { isValidModelScale, originalScale } from "./model-scale";

const axes = ["X", "Y", "Z"];
const dimensions = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const scaleRange = { min: 1, max: 400 };

export default function ScaleInputs({ model, scale, locked, onLock, onScale, tooLarge, hasFileUnits }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");

  const uniform = scale.every(factor => factor === scale[0]);
  const percent = uniform ? Number((scale[0] * 100).toPrecision(7)) : "";
  const formatSize = (size) => size.map(axis => dimensions.format(axis)).join(" × ");

  function applyScale(next) {
    setDraft(null);
    if (!isValidModelScale(model, next)) {
      setError("กรอกขนาดหรือเปอร์เซ็นต์ที่มากกว่า 0 และอยู่ในช่วงที่คำนวณได้");
      return;
    }
    setError("");
    onScale(next);
  }

  function applyUniform(value) {
    const factor = Number(value) / 100;
    applyScale([factor, factor, factor]);
  }

  function apply(axis, unit, value) {
    const factor = Number(value) / (unit === "%" ? 100 : model.size[axis]);
    const next = scale.map((current, index) => locked && index !== axis
      ? current * factor / scale[axis] : index === axis ? factor : current);
    applyScale(next);
  }

  return <section className="scale-inputs" aria-label="ปรับขนาดชิ้นงาน">
    <div className="scale-grid">
      <span>แกนของโมเดล</span>
      {axes.map((axis) => <strong key={axis} className={"axis-" + axis.toLowerCase()}>{axis}</strong>)}
      {["%", "มม."].map((unit) => (
        <div className="scale-grid-row" key={unit}>
          <span>{unit === "%" ? "สเกล (%)" : "ขนาด (มม.)"}</span>
          {axes.map((axis, index) => {
            const id = unit + axis;
            const value = scale[index] * (unit === "%" ? 100 : model.size[index]);
            return <input key={axis} type="number" inputMode="decimal" step="any"
              aria-label={unit === "%" ? "สเกลแกน " + axis + " (%)" : "ขนาดแกน " + axis + " (มม.)"}
              value={draft?.id === id ? draft.value : Number(value.toPrecision(7))}
              onChange={(event) => setDraft({ id, value: event.target.value })}
              onBlur={(event) => { if (draft?.id === id) apply(index, unit, event.target.value); }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
          })}
        </div>
      ))}
    </div>
    <div className="uniform-scale">
      <label htmlFor="uniform-scale-value">สเกลทุกแกน</label>
      <input id="uniform-scale-value" type="number" min="0" step="any" inputMode="decimal"
        aria-label="สเกลทุกแกน (%)" placeholder="ต่างกัน"
        value={draft?.id === "uniform" ? draft.value : percent}
        onChange={event => setDraft({ id: "uniform", value: event.target.value })}
        onBlur={event => { if (draft?.id === "uniform") applyUniform(event.target.value); }}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      <span aria-hidden="true">%</span>
      <input className="uniform-scale-slider" type="range" {...scaleRange}
        aria-label="แถบเลื่อนสเกลทุกแกน" aria-valuetext={uniform ? percent + "%" : "แต่ละแกนมีสเกลต่างกัน"}
        value={Math.min(scaleRange.max, Math.max(scaleRange.min, percent || 100))}
        onChange={event => applyUniform(event.target.value)} />
    </div>
    <div className="scale-footer">
      <label><input type="checkbox" checked={locked} onChange={(event) => onLock(event.target.checked)} /> ล็อกสัดส่วน</label>
      <button type="button" className="apply-rotation" disabled={!error && scale.every((factor) => factor === 1)} onClick={() => {
        setDraft(null);
        setError("");
        onScale(originalScale);
      }}>คืนขนาดเดิม</button>
    </div>
    {!hasFileUnits && <details className="scale-conversion">
      <summary>แปลงหน่วยของไฟล์</summary>
      <p>ใช้ขนาดต้นฉบับของไฟล์เป็นฐาน</p>
      <div className="tool-group">
        <button type="button" onClick={() => applyUniform(1000)}>ซม. → มม.</button>
        <button type="button" onClick={() => applyUniform(2540)}>นิ้ว → มม.</button>
      </div>
    </details>}
    <p className="scale-size-summary">ขนาดเดิม {formatSize(model.size)} → {formatSize(model.size.map((size, axis) => size * scale[axis]))} มม.</p>
    {tooLarge && <p className="alert compact" role="status">ขนาดหลังปรับเกินพื้นที่พิมพ์ในแนววางปัจจุบัน</p>}
    {error && <p className="alert compact" role="alert">{error}</p>}
  </section>;
}
