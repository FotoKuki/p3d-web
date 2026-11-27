"use client";

import { useEffect, useState } from "react";
import { rotationFromDegrees, rotationToDegrees } from "./placement";

const axes = ["X", "Y", "Z"];
const zero = [0, 0, 0];

function RotationRow({ label, values, onChange, onApply }) {
  return (
    <form className="rotation-row" onSubmit={(event) => {
      event.preventDefault();
      const angles = values.map(Number);
      if (angles.every(Number.isFinite)) onApply(angles);
    }}>
      <span className="rotation-row-label">{label}</span>
      {axes.map((axis, index) => (
        <div className={"angle-field angle-" + axis.toLowerCase()} key={axis}>
          <input type="number" inputMode="decimal" step="any" required value={values[index]}
            aria-label={label + " แกน " + axis}
            onChange={(event) => onChange(values.map((value, i) => i === index ? event.target.value : value))} />
          <span aria-hidden="true">°</span>
        </div>
      ))}
      <button type="submit" className="apply-rotation" aria-label={"ใช้" + label}>ใช้ค่า</button>
    </form>
  );
}

export default function RotationInputs({ orientation, onRotate }) {
  const [relative, setRelative] = useState(zero);
  const [absolute, setAbsolute] = useState(() => rotationToDegrees(orientation));

  useEffect(() => {
    setAbsolute(rotationToDegrees(orientation));
  }, [orientation]);

  return (
    <section className="rotation-inputs" aria-label="ปรับองศาการหมุน">
      <div className="rotation-head" aria-hidden="true">
        <span>แกนอ้างอิงแผ่นพิมพ์</span>
        {axes.map((axis) => <strong className={"axis-" + axis.toLowerCase()} key={axis}>{axis}</strong>)}
      </div>
      <RotationRow label="หมุนเพิ่ม" values={relative} onChange={setRelative} onApply={(angles) => {
        onRotate(rotationFromDegrees(angles).multiply(orientation).normalize());
        setRelative(zero);
      }} />
      <RotationRow label="มุมสัมบูรณ์" values={absolute} onChange={setAbsolute} onApply={(angles) => {
        onRotate(rotationFromDegrees(angles));
        setRelative(zero);
      }} />
    </section>
  );
}
