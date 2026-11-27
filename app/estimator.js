"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Quaternion, Vector3 } from "three";
import { signOut } from "next-auth/react";
import { Box, Calculator, CircleHelp, ClipboardList, FileBox, Layers3, LogOut, Minus, Plus, TriangleAlert, UploadCloud, UserRound, X } from "lucide-react";
import { describePart, exportPrintSet } from "./print-set";
import { demoModel, readModel } from "./model";
import { estimate, materials, settings } from "./pricing";
import { infillOptions, layerOptions, wallOptions } from "../lib/print-options";
import { shippingMethods, shopLineChatUrl } from "../lib/shipping-options";
import PlateIcon from "./plate-icon";
import { findPlateSpot, maxPlates, placeParts, plateOffset } from "./plate-layout";
import Preview from "./preview";
import ModelListPanel from "./model-list-panel";
import ThemeToggle from "./theme-toggle";
import BrandLink from "./brand-link";
import { useRouter } from "next/navigation";
import { readOrderDraft, saveOrderDraft } from "./order-draft";
import RotationInputs from "./rotation-inputs";
import ScaleInputs from "./scale-inputs";
import { isValidModelScale, originalScale, scaleModel } from "./model-scale";
import { arrangeCopies, buildOverhang, clampPlatePosition, fitsPlate, hasOverhang, layFlat, measurePlacement, orientOnFace, originalOrientation, plateCenter, rotatePart } from "./placement";
import { buildTreeSupport } from "./tree-support";

const digits = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });
const baht = (value) => "฿" + digits.format(value);



const rotationAxes = [
  { label: "X", axis: new Vector3(1, 0, 0) },
  { label: "Y", axis: new Vector3(0, 1, 0) },
  { label: "Z", axis: new Vector3(0, 0, 1) },
];
const plateTools = [
  ["move", "เลื่อนชิ้นงาน (M)", "ลากลูกศรบนเพลต หรือกรอกตำแหน่งตามแกน X, Y และ Z", "M"],
  ["rotate", "หมุนชิ้นงาน (R)", "ลากวงแหวนเพื่อหมุน หรือกำหนดมุมของแต่ละแกน", "R"],
  ["scale", "ปรับขนาดชิ้นงาน", "กรอกขนาดเป็นมิลลิเมตรหรือเปอร์เซ็นต์ เปิดล็อกสัดส่วนเพื่อปรับทุกแกนพร้อมกัน"],
  ["face", "วางตามผิว (F)", "คลิกผิวราบของชิ้นงานที่เลือก เพื่อหันด้านนั้นลงแนบเพลต", "F"],
  ["flat", "วางราบอัตโนมัติ", "ค้นหาด้านราบและวางชิ้นงานที่เลือกลงบนเพลต"],
  ["arrange", "จัดเรียง (Arrange)", "จัดตำแหน่งชิ้นงานบนเพลตโดยเว้นช่องว่างระหว่างชิ้น"],
  ["overhang", "Overhang", "ตรวจผิวที่ยื่นออกมาและอาจต้องใช้ซัพพอร์ต"],
];
const cameraViews = [
  ["default", "ISO", "มุมไอโซเมตริก"],
  ["front", "หน้า", "มุมด้านหน้า"],
  ["top", "บน", "มุมด้านบน"],
  ["right", "ขวา", "มุมด้านขวา"],
  ["fit", "พอดีจอ", "ซูมให้ชิ้นงานพอดีจอ"],
];
const centered = [[0, 0]];

const materialOptions = Object.entries(materials).map(([name, rate]) => ({
  value: name,
  label: name,
  detail: rate.description,
  rate: "฿" + rate.bahtPerGram.toFixed(2) + "/กรัม",
}));

function printTime(minutes) {
  const hours = Math.floor(minutes / 60);
  return (hours ? hours + " ชม. " : "") + (minutes % 60) + " นาที";
}

function PrintOption({ label, selected, layout, options, value, onChange }) {
  return (
    <fieldset className="print-option">
      <legend>{label}</legend>
      <div className="option-heading" aria-hidden="true"><span>{label}</span><span>{selected}</span></div>
      <div className={"option-grid " + layout}>
        {options.map((option) => (
          <label className="option-choice" key={option.value}>
            <input type="radio" name={layout} value={option.value} checked={option.value === value} disabled={option.disabled}
              aria-label={[option.label, option.detail, option.rate].filter(Boolean).join(" ")}
              onChange={() => onChange(option.value)} />
            {layout === "color-options" ? (
              <span className="color-chip" style={{ "--swatch": option.hex }} title={option.label} />
            ) : (
              <span className="option-card">
                <strong>{option.label}</strong>
                {option.detail && <small>{option.detail}</small>}
                {option.rate && <span className="material-rate">{option.rate}</span>}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Estimator({ account, resumeOrder, filaments }) {
  const [sample, setSample] = useState(null);
  const [selection, setSelection] = useState(null);
  const [modelError, setModelError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [material, setMaterial] = useState(() => materialOptions.find(option => filaments.some(row => row.material === option.value))?.value ?? "PLA");
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [wallCount, setWallCount] = useState(2);
  const [support, setSupport] = useState(false);
  const [colorChoice, setColorChoice] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [reset, setReset] = useState(0);
  const [orientation, setOrientation] = useState(originalOrientation);
  const [scale, setScale] = useState(originalScale);
  const [position, setPosition] = useState(plateCenter);
  const [scaleLocked, setScaleLocked] = useState(true);
  const [rotationStep, setRotationStep] = useState(90);
  const [arranged, setArranged] = useState(false);
  const [plateCount, setPlateCount] = useState(1);
  const [activePlate, setActivePlate] = useState(0);
  const [plateMessage, setPlateMessage] = useState("");
  const [plateIndex, setPlateIndex] = useState(0);
  const [view, setView] = useState("default");
  const [showOverhang, setShowOverhang] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const faceMode = activeTool === "face";
  const rotationMode = activeTool === "rotate";
  const scaleMode = activeTool === "scale";
  const moveMode = activeTool === "move";
  const [placementMessage, setPlacementMessage] = useState("");
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const input = useRef(null);
  const request = useRef(0);
  const onUnavailable = useCallback(() => setPreviewUnavailable(true), []);

  useEffect(() => {
    const initial = demoModel();
    setSample(initial);
    return () => initial.geometry.dispose();
  }, []);
  const [parts, setParts] = useState([]);
  const owned = useRef(new Set());
  useEffect(() => () => {
    for (const model of owned.current) model.geometry.dispose();
    owned.current.clear();
  }, []);
  function activate(part) {
    setSelection(part);
    setActivePlate(part.plate ?? 0);
    setOrientation(part.orientation);
    setScale(part.scale);
    setPosition(part.position);
    setPlacementMessage("");
  }
  useEffect(() => () => { request.current++; }, []);


  useEffect(() => {
    if (!resumeOrder) return;
    let cancelled = false;
    async function restore() {
      try {
        const draft = await readOrderDraft();
        if (!draft || cancelled) return;
        const restored = [];
        for (const item of draft.parts ?? [draft]) {
          const model = await readModel(item.file);
          if (cancelled) { model.geometry.dispose(); return; }
          owned.current.add(model);
          restored.push(describePart({file:item.file, name:item.file.name, model, plate:item.plate ?? 0},
            new Quaternion().fromArray(item.orientation).normalize(),
            isValidModelScale(model, item.scale) ? item.scale : originalScale, item.position ?? plateCenter));
        }
        setParts(restored);
        setPlateCount(Math.max(draft.plateCount ?? 1, ...restored.map(part => part.plate + 1)));
        activate(restored[draft.activeIndex] ?? restored[0]);
        setArranged(draft.arranged === true);
        setMaterial(draft.printSettings.material);
        setColorChoice(draft.printSettings.stockId ?? draft.printSettings.color);
        setLayerHeight(draft.printSettings.layerHeight);
        setInfill(draft.printSettings.infill);
        setWallCount(draft.printSettings.wallCount);
        setQuantity(draft.printSettings.quantity);
        setSupport(draft.printSettings.support);
        setShowOverhang(draft.printSettings.support);
      } catch {
        if (!cancelled) setModelError("เปิดไฟล์จากก่อนเข้าสู่ระบบไม่ได้ กรุณาเลือกไฟล์อีกครั้ง");
      } finally {
        if (!cancelled) window.history.replaceState(null, "", "/estimate");
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [resumeOrder]);

  const source = selection?.model ?? sample;
  const model = useMemo(() => source && scaleModel(source, scale), [source, scale]);
  useEffect(() => () => { if (model && model !== source) model.geometry.dispose(); }, [model, source]);

  const basePlacement = useMemo(() => model && measurePlacement(model, orientation), [model, orientation]);
  const tooLarge = Boolean(selection && basePlacement && !fitsPlate(basePlacement.size, settings.buildSize));
  const plates = useMemo(() => plateCount === 1 && parts.length <= 1 && arranged && basePlacement && fitsPlate(basePlacement.size, settings.buildSize)
    ? arrangeCopies(basePlacement.size, quantity, settings.buildSize) : [centered], [plateCount, parts.length, arranged, basePlacement, quantity]);
  const clampMove = useCallback((next) => basePlacement
    ? clampPlatePosition(next, basePlacement.size, settings.buildSize, plates) : plateCenter, [basePlacement, plates]);
  const currentPosition = useMemo(() => clampMove(position), [clampMove, position]);
  useEffect(() => {
    if (currentPosition.some((value, axis) => value !== position[axis])) setPosition(currentPosition);
  }, [currentPosition, position]);
  const [moveX, moveY, lift] = currentPosition;
  const placement = useMemo(() => {
    if (!basePlacement || !lift) return basePlacement;
    return { size: basePlacement.size, offset: basePlacement.offset.clone().add(new Vector3(0, 0, lift)) };
  }, [basePlacement, lift]);
  const baseOffsets = plates[plateIndex] ?? plates[0] ?? centered;
  const selectedPlate = selection?.plate ?? 0;
  const offsets = useMemo(() => {
    const [plateX, plateY] = plateOffset(selectedPlate, settings.buildSize);
    if (!moveX && !moveY && !plateX && !plateY) return baseOffsets;
    return baseOffsets.map(([x, y]) => [x + moveX + plateX, y + moveY + plateY]);
  }, [baseOffsets, moveX, moveY, selectedPlate]);
  const changePosition = useCallback((next) => {
    const clamped = clampMove(next);
    setPosition(clamped);
    setPlacementMessage(clamped.some((value, axis) => Math.abs(value - next[axis]) > 0.001)
      ? "ปรับตำแหน่งให้อยู่ในขอบเขตแผ่นพิมพ์แล้ว" : "");
  }, [clampMove]);
  const needsOverhang = showOverhang || support;
  const overhang = useMemo(() => needsOverhang && model && placement
    ? buildOverhang(model, orientation, placement.offset.z) : null, [needsOverhang, model, placement, orientation]);
  useEffect(() => () => overhang?.dispose(), [overhang]);
  const warnOverhang = useMemo(() => Boolean(selection && !support && placement && (
    needsOverhang ? overhang : hasOverhang(model, orientation, placement.offset.z)
  )), [selection, support, placement, needsOverhang, overhang, model, orientation]);
  const treeSupport = useMemo(() => support && overhang && fitsPlate(placement.size, settings.buildSize)
    ? buildTreeSupport(model, overhang, orientation, placement) : null, [support, overhang, placement, model, orientation]);
  useEffect(() => () => treeSupport?.dispose(), [treeSupport]);
  const colors = filaments.filter(row => row.material === material).map(row => ({ ...row, value: row.id }));
  const legacyMatches = colors.filter(row => row.hex === colorChoice);
  const filament = colorChoice === null ? colors[0] : colors.find(row => row.id === colorChoice) ??
    (legacyMatches.length === 1 ? legacyMatches[0] : undefined);
  const color = filament?.hex ?? "#808080";
  const printSettings = { material, color, colorLabel: filament?.label, stockId: filament?.id, layerHeight, infill, wallCount, support, quantity };
  const availableMaterials = materialOptions.map(option => filaments.some(row => row.material === option.value)
    ? option : { ...option, disabled: true, detail: "หมดสต๊อก" });
  const others = useMemo(() => parts.filter(p => p.file !== selection?.file), [parts, selection]);
  const currentParts = () => parts.map(p => p.file === selection?.file
    ? { ...p, orientation, scale, position:currentPosition, placement:basePlacement } : p);
  function selectPart(file) {
    if (loading || file === selection?.file) return;
    const list = currentParts();
    setParts(list);
    activate(list.find(p => p.file === file));
  }
  function removePart(item) {
    if (loading) return;
    if (item.demo) {
      setSelection(null);
      clearPlacement();
      return;
    }
    const list = currentParts();
    const target = list.find(p => p.file === item.file);
    const next = list.filter(p => p.file !== item.file);
    if (target?.model && owned.current.has(target.model)) {
      target.model.geometry.dispose();
      owned.current.delete(target.model);
    }
    setParts(next);
    if (next.length === 0) {
      setSelection(null);
      setPlateCount(1);
      setActivePlate(0);
      clearPlacement();
    } else if (selection?.file === item.file) {
      activate(next[0]);
    }
  }
  function clearAllParts() {
    if (loading) return;
    for (const item of owned.current) item.geometry.dispose();
    owned.current.clear();
    setParts([]);
    setSelection(null);
    setPlateCount(1);
    setActivePlate(0);
    setModelError("");
    setPlateMessage("");
    clearPlacement();
  }
  function movePartToPlate(plate) {
    const list = currentParts();
    const part = list.find(item => item.file === selection?.file);
    if (!part || part.plate === plate) return;
    const spot = findPlateSpot(part, list.filter(item => item.plate === plate), settings.buildSize);
    if (!spot) {
      setPlateMessage("เพลตนี้มีพื้นที่ไม่พอสำหรับชิ้นงาน ลองจัดเรียงหรือเลือกเพลตอื่น");
      return;
    }
    const moved = { ...part, plate, position: spot };
    setParts(list.map(item => item === part ? moved : item));
    activate(moved);
    setPlateMessage("");
  }
  function removePlate(index) {
    if (plateCount <= 1 || loading) return;
    const list = currentParts();
    const nextCount = plateCount - 1;
    const next = list.filter(part => part.plate !== index).map(part =>
      part.plate > index ? { ...part, plate: part.plate - 1 } : part);
    const displaced = list.filter(part => part.plate === index).sort((a, b) =>
      b.placement.size[0] * b.placement.size[1] - a.placement.size[0] * a.placement.size[1]);

    for (const part of displaced) {
      let destination = null;
      for (let plate = 0; plate < nextCount; plate++) {
        const position = findPlateSpot(part, next.filter(other => other.plate === plate), settings.buildSize);
        if (!position) continue;
        destination = { ...part, plate, position };
        break;
      }
      if (!destination) {
        setPlateMessage("เพลตที่เหลือมีพื้นที่ไม่พอ ลองจัดเรียงหรือย้ายชิ้นงานก่อนลบเพลตนี้");
        return;
      }
      next.push(destination);
    }

    setParts(next);
    setPlateCount(nextCount);
    const selected = next.find(part => part.file === selection?.file);
    if (selected) activate(selected);
    const movedSelection = displaced.some(part => part.file === selection?.file);
    const nextActive = activePlate > index ? activePlate - 1 : Math.min(activePlate, nextCount - 1);
    setActivePlate(activePlate === index && movedSelection ? selected.plate : nextActive);
    setPlateMessage(displaced.length
      ? "ลบเพลตและย้ายชิ้นงาน " + displaced.length + " ชิ้นแล้ว"
      : "ลบเพลตแล้ว");
  }
  function applyPlateLayout(list) {
    setParts(list);
    setPlateCount(count => Math.max(count, ...list.map(part => part.plate + 1)));
  }
  const invalidOther = others.some(p => p.placement.size.some((v,i) => i === 2 ? p.position[i] + v > settings.buildSize[i] + 0.001 :
    Math.abs(p.position[i]) + v / 2 > settings.buildSize[i] / 2 + 0.001));
  const volume = others.reduce((n,p) => n + p.model.volume * p.scale.reduce((a,b)=>a*b,1), model?.volume ?? 0);
  const quote = selection && model && !tooLarge && !invalidOther ? estimate({volume}, printSettings) : null;
  const enoughStock = Boolean(filament && (!quote || filament.grams >= quote.weight));

  async function openCheckout() {
    if (openingCheckout || !enoughStock) return;
    setOpeningCheckout(true);
    setModelError("");
    try {
      const list = currentParts();
      const multiple = list.length > 1;
      const occupied = [...new Set(list.map(part => part.plate ?? 0))].sort((a, b) => a - b);
      const plateFiles = occupied.length > 1 ? occupied.map(plate =>
        exportPrintSet(list.filter(part => part.plate === plate), `plate-${plate + 1}.stl`)) : null;
      await saveOrderDraft({ file: plateFiles ? new File([], `ชุดพิมพ์-${plateFiles.length}-เพลต.zip`) : multiple ? exportPrintSet(list) : selection.file,
        plateFiles, plateCount,
        parts: list.map(p => ({file:p.file, plate:p.plate, position:p.position, scale:p.scale, orientation:p.orientation.toArray()})),
        activeIndex:list.findIndex(p => p.file === selection.file), orientation: orientation.toArray(), scale, position: currentPosition, arranged, printSettings, quote, requestId: crypto.randomUUID() });
      router.push("/checkout");
    } catch {
      setModelError("เบราว์เซอร์บันทึกไฟล์ชั่วคราวไม่ได้ กรุณาลองอีกครั้ง");
      setOpeningCheckout(false);
    }
  }

  const changeOrientation = useCallback((next) => {
    setOrientation(next);
    setActiveTool((tool) => tool === "face" ? null : tool);
    setPlateIndex(0);
    setPlacementMessage("");
  }, []);

  const onLayFace = useCallback((plane) => {
    const next = orientOnFace(model, orientation, plane);
    if (!next) {
      setPlacementMessage("ด้านนี้แนบแผ่นไม่ได้ เพราะมีส่วนอื่นของโมเดลยื่นต่ำกว่า เลือกผิวอื่นได้เลย");
      return;
    }
    changeOrientation(next);
    setPosition(([x, y]) => [x, y, 0]);
  }, [model, orientation, changeOrientation]);

  useEffect(() => {
    function shortcut(event) {
      if (!model || loading || previewUnavailable
        || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.target?.closest?.("input, select, textarea, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      if (key === "f" || key === "r" || (key === "m" && selection && !tooLarge)) {
        event.preventDefault();
        const nextTool = key === "f" ? "face" : key === "r" ? "rotate" : "move";
        setActiveTool((tool) => tool === nextTool ? null : nextTool);
        setPlacementMessage("");
      }
      if (key === "escape") setActiveTool(null);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [model, loading, previewUnavailable, selection, tooLarge]);

  function placeFlat() {
    const next = layFlat(model, settings.buildSize);
    if (next) {
      changeOrientation(next);
      setPosition(([x, y]) => [x, y, 0]);
    }
    else setPlacementMessage("ไม่พบด้านราบที่วางบนแผ่นได้ ลองหมุนชิ้นงานทีละแกน");
  }

  function changeView(mode) {
    setView(mode);
    setReset((value) => value + 1);
  }

  function changeQuantity(amount) {
    setQuantity(amount);
    setPlateIndex(0);
  }

  function clearPlacement() {
    changeOrientation(originalOrientation);
    setScale(originalScale);
    setPosition(plateCenter);
    setActiveTool(null);
    setArranged(false);
    changeView("default");
  }

  function changeSupport(enabled) {
    setSupport(enabled);
    setShowOverhang(enabled);
    changeView(enabled ? "support" : "default");
  }

  function toggleOverhang(next) {
    setShowOverhang(next);
    if (next) changeView("below");
    else if (view === "below") changeView(support ? "support" : "default");
  }

  function chooseTool(id) {
    const closing = activeTool === id;
    setPlacementMessage("");
    if (id === "overhang") toggleOverhang(!closing);
    if (!closing && id === "flat") placeFlat();
    if (!closing && id === "arrange") {
      if (parts.length > 1 || plateCount > 1) {
        const list = currentParts();
        const local = list.filter(part => part.plate === activePlate);
        const next = placeParts(list.filter(part => part.plate !== activePlate), local, activePlate, settings.buildSize);
        if (!next) { setModelError("พื้นที่บนเพลตไม่พอสำหรับจัดเรียง"); return; }
        applyPlateLayout(next);
        if (selection?.file) activate(next.find(part => part.file === selection.file));
      } else setArranged(true);
      setPlateIndex(0);
      changeView("top");
    }
    setActiveTool(closing ? null : id);
  }
  const toolInfo = plateTools.find(([id]) => id === activeTool);
  async function openFiles(files) {
    if (loading) return;
    const id = ++request.current;
    setLoading(true);
    setModelError("");
    const added = [];
    try {
      const list = currentParts();
      for (const file of files) {
        const model = await readModel(file);
        added.push(describePart({ file, name:file.name, model }, originalOrientation, originalScale, plateCenter));
      }
      if (id !== request.current) return;
      if ([...list,...added].reduce((n,p) => n+p.model.geometry.attributes.position.count/3,0) > 240000)
        throw new Error("ชิ้นงานรวมกันต้องไม่เกิน 240,000 สามเหลี่ยม");
      const next = placeParts(list, added, activePlate, settings.buildSize);
      if (!next) throw new Error("พื้นที่บนเพลตไม่พอสำหรับชิ้นงานทั้งหมด");
      added.forEach(p => owned.current.add(p.model));
      applyPlateLayout(next);
      activate(next.find(p => p.file === added[0].file));
      setArranged(false);
      setPlateIndex(0);
    } catch (error) {
      if (id === request.current) {
        setModelError(/[ก-๙]/.test(error.message) ? error.message : "อ่านโมเดลไม่ได้ ลองส่งออกไฟล์ใหม่แล้วเลือกอีกครั้ง");
      }
    } finally {
      added.forEach(p => { if (!owned.current.has(p.model)) p.model.geometry.dispose(); });
      if (id === request.current) setLoading(false);
    }
  }

  function useDemo() {
    request.current++;
    setLoading(false);
    setModelError("");
    clearPlacement();
    setSelection({ name: "p3d-sample.stl", model: sample, demo: true });
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner estimate-header">
          <BrandLink />
          <div className="account">
            <Link href="/orders" className="account-link"><ClipboardList size={16} aria-hidden="true" /><span>คิวของฉัน</span></Link>
            {account ? (
              <>
                <Link href="/account" className="account-link" title={account}><UserRound size={16} aria-hidden="true" /><span>บัญชี</span></Link>
                <button className="icon-button logout" type="button" onClick={() => signOut({ redirectTo: "/estimate" })} aria-label="ออกจากระบบ"><LogOut size={17} /></button>
              </>
            ) : (
              <Link href="/account?next=estimate" className="account-link"><UserRound size={16} aria-hidden="true" /><span>เข้าสู่ระบบ</span></Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="workspace estimate-workspace">
        <section className="intro"><h1>ประเมินราคาพิมพ์ 3 มิติ</h1><p>เปิดไฟล์โมเดล เลือกวัสดุและการตั้งค่า แล้วดูราคาพิมพ์เบื้องต้น</p></section>
        <div className="columns">
          <section className="model-panel" aria-labelledby="model-heading">
            <div className="panel-head">
              <div className="panel-icon"><Layers3 size={19} /></div>
              <div><h2 id="model-heading">โมเดล 3 มิติ</h2><p className="size-limit">ขนาดพิมพ์สูงสุด {settings.buildSize.join(" × ")} มม.</p></div>
              <button type="button" className="estimate-upload" onClick={() => input.current?.click()}>{selection?.file ? "เพิ่มไฟล์" : "เลือกไฟล์"}</button>
            </div>
            <div className="plate-workbench">
              <div className="plate-rail" role="group" aria-label="เครื่องมือชิ้นงาน">
                {plateTools.map(([id, label, , shortcut]) => (
                  <button key={id} type="button" aria-label={label} title={label} aria-keyshortcuts={shortcut}
                    aria-pressed={activeTool === id} aria-controls={activeTool === id ? "plate-tool-panel" : undefined} onClick={() => chooseTool(id)}
                    disabled={loading || !model || (id === "scale" || id === "move" ? !selection : previewUnavailable)
                      || (id === "move" || id === "arrange") && tooLarge}>
                    <PlateIcon tool={id} />
                  </button>
                ))}
              </div>
              {selection && <section className="plate-part-list" aria-label="รายการชิ้นงาน">
                <h3>ชิ้นงาน <span>{parts.length || 1}</span></h3>
                <ul>
                  {(parts.length ? parts : [selection]).map((part, index) => {
                    const selected = part.file === selection.file;
                    return (
                      <li className="plate-part-row" key={index}>
                        <button type="button" className="plate-part-name" title={part.name}
                          disabled={loading || selection.demo} aria-pressed={selected} onClick={() => selectPart(part.file)}>
                          <FileBox size={15} aria-hidden="true" /><span>{selected ? "✓ " : ""}{part.name}</span>
                        </button>
                        <button type="button" disabled={loading} className="icon-button" aria-label={"นำ " + part.name + " ออก"} onClick={() => {
                          const next = currentParts().filter((_, i) => i !== index);
                          setParts(next);
                          if (part.model && owned.current.delete(part.model)) part.model.geometry.dispose();
                          if (next.length) activate(next.find(p => p.file === selection.file) ?? next[0]);
                          else { setSelection(null); clearPlacement(); }
                        }}><X size={16} /></button>
                      </li>
                    );
                  })}
                </ul>
                <small>{placement.size.map((axis) => digits.format(axis)).join(" × ")} มม.</small>
              </section>}
            <div className="viewport">
              {!previewUnavailable && <Preview plateCount={plateCount} activePlate={activePlate} others={others} onSelectPart={selectPart} model={model} placement={placement} orientation={orientation} offsets={offsets} overhang={showOverhang ? overhang : null} treeSupport={treeSupport} faceMode={faceMode} onLayFace={onLayFace} rotationMode={rotationMode} onRotate={changeOrientation}
                moveMode={moveMode && !tooLarge} position={currentPosition} clampMove={clampMove} onMove={changePosition}
                color={color} view={view} reset={reset} onUnavailable={onUnavailable} />}
              {previewUnavailable && <div className="preview-fallback"><Box size={44} /><span>อุปกรณ์นี้แสดงตัวอย่าง 3 มิติไม่ได้</span></div>}
              {!previewUnavailable && <>
                <div className="view-tip">{faceMode ? "คลิกหรือแตะผิวที่ต้องการวาง" : rotationMode ? "ลากวงแหวนเพื่อหมุนชิ้นงาน" : moveMode && !tooLarge ? "ลากลูกศร X / Y / Z เพื่อเลื่อนชิ้นงาน" : <>
                  <span className="view-tip-mouse">คลิกซ้ายค้างแล้วลากเพื่อหมุน · คลิกขวาค้างแล้วลากเพื่อเลื่อน · ล้อเมาส์ซูม</span>
                  <span className="view-tip-touch">ลากหนึ่งนิ้วเพื่อหมุนกล้อง · ใช้สองนิ้วเพื่อเลื่อนหรือซูม</span>
                </>}</div>
              </>}
            </div>

              {!previewUnavailable && <div className="camera-bar" role="group" aria-label="มุมกล้อง">
                <svg className="camera-axes" viewBox="0 0 24 24" width="20" height="20" fill="none" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 15V4m-2 2 2-2 2 2" stroke="#70a9f5" />
                  <path d="m11 15 9-4m-3-1 3 1-1 3" stroke="#ef777d" />
                  <path d="m11 15-8-3m2 3-2-3 3-1" stroke="#72c89a" />
                </svg>
                {cameraViews.map(([mode, label, name]) => (
                  <button key={mode} type="button" title={name} aria-pressed={view === mode}
                    onClick={() => changeView(mode)}>{label}</button>
                ))}
              </div>}
              {toolInfo && <section id="plate-tool-panel" className="plate-tool-panel" aria-labelledby="plate-tool-title">
                <header>
                  <h3 id="plate-tool-title">{toolInfo[1]}</h3>
                  <button type="button" className="icon-button" aria-label="ปิดแผงเครื่องมือ" onClick={() => setActiveTool(null)}><X size={16} /></button>
                </header>
                <div className="plate-tool-body">
                  <p className="tool-description">{toolInfo[2]}</p>
                  {rotationMode && <div className="tool-group" role="group" aria-label="หมุนชิ้นงาน">
                    <select id="rotation-step" aria-label="องศาที่หมุน" value={rotationStep} onChange={(event) => setRotationStep(Number(event.target.value))}>
                      {[15, 45, 90, -15, -45, -90].map((step) => <option key={step} value={step}>{step > 0 ? "+" : ""}{step}°</option>)}
                    </select>
                    {rotationAxes.map(({ label, axis }) => (
                      <button type="button" key={label} disabled={!model || loading} aria-label={"หมุนแกน " + label}
                        onClick={() => changeOrientation(rotatePart(orientation, axis, rotationStep))}>{label}</button>
                    ))}
                    <button type="button" className="reset-part" disabled={orientation === originalOrientation} onClick={() => changeOrientation(originalOrientation)}>คืนแนวเดิม</button>
                  </div>}
                  {rotationMode && <RotationInputs orientation={orientation} onRotate={changeOrientation} />}
                  {activeTool === "overhang" && <div className="tool-group">
                    {showOverhang && <button type="button" onClick={() => changeView("below")}>ดูใต้ชิ้นงาน</button>}
                    {treeSupport && <button type="button" onClick={() => changeView("support")}>ดูกิ่งซัพพอร์ต</button>}
                  </div>}
                  {moveMode && !tooLarge && <form className="scale-inputs" aria-label="ตำแหน่งชิ้นงาน" key={currentPosition.join(",")} onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const coordinates = rotationAxes.map(({ label }) => Number(data.get(label)));
                    if (coordinates.every(Number.isFinite)) changePosition(coordinates);
                    event.currentTarget.reset();
                  }}>
                    <div className="scale-grid">
                      <span>ตำแหน่ง (มม.)</span>
                      {rotationAxes.map(({ label }, axis) => <label key={label} className={"axis-" + label.toLowerCase()}>
                        {label}<input aria-label={"ตำแหน่งแกน " + label + " (มม.)"} name={label} type="number"
                          inputMode="decimal" step="any" required defaultValue={Number(currentPosition[axis].toFixed(3))} />
                      </label>)}
                    </div>
                    <div className="scale-footer">
                      <button type="button" className="apply-rotation" onClick={(event) => {
                        event.currentTarget.form.reset();
                        changePosition(plateCenter);
                      }}>คืนตำแหน่ง</button>
                      <button type="submit" className="apply-rotation">ใช้ตำแหน่ง</button>
                    </div>
                  </form>}
                  {scaleMode && <ScaleInputs key={parts.indexOf(selection)} model={source} tooLarge={tooLarge} hasFileUnits={selection.name.toLowerCase().endsWith(".3mf")} scale={scale} locked={scaleLocked} onLock={setScaleLocked} onScale={(next) => {
                    setScale(next);
                    setPlateIndex(0);
                    setPlacementMessage("");
                  }} />}
                  {placementMessage && <p className="overhang-guide" role="status">{placementMessage}</p>}
                </div>
              </section>}
            </div>
            {!previewUnavailable && <div className="plate-tools">
              <div className="plate-pages" role="group" aria-label="จัดการเพลต">
                {Array.from({ length: plateCount }, (_, index) => (
                  <div key={index} className="plate-tab" data-active={activePlate === index}>
                    <button className="plate-tab-select" type="button" aria-pressed={activePlate === index} onClick={() => {
                      const first = currentParts().find(part => part.plate === index);
                      if (first) selectPart(first.file);
                      setActivePlate(index);
                      setPlateMessage("");
                      changeView("top");
                    }}>เพลต {index + 1}</button>
                    {plateCount > 1 && <button type="button" className="plate-remove" disabled={loading}
                      aria-label={"ลบเพลต " + (index + 1)} title={"ลบเพลต " + (index + 1)}
                      onClick={() => removePlate(index)}><X size={15} aria-hidden="true" /></button>}
                  </div>
                ))}
                <button type="button" disabled={loading || plateCount >= maxPlates} onClick={() => {
                  setPlateMessage("");
                  setActivePlate(plateCount);
                  setPlateCount(plateCount + 1);
                  setArranged(false);
                  changeView("top");
                }}>+ เพิ่มเพลต</button>
                {plateCount > 1 && selection?.file && <label className="plate-transfer">
                  ย้ายชิ้นที่เลือกไปที่
                  <select aria-label="ย้ายชิ้นที่เลือกไปที่" value={selectedPlate} disabled={loading} onChange={event => movePartToPlate(Number(event.target.value))}>
                    {Array.from({ length: plateCount }, (_, index) => <option key={index} value={index}>เพลต {index + 1}</option>)}
                  </select>
                </label>}
              </div>
              {plateMessage && <p className="overhang-guide" role="status">{plateMessage}</p>}
              <div className="plate-caption">
                <span aria-live="polite">แผ่นพิมพ์ {plateCount > 1 ? activePlate + 1 : plateIndex + 1}/{plateCount > 1 ? plateCount : plates.length} · {parts.length > 1 ? parts.length + " ชิ้นต่อชุด" : offsets.length + "/" + quantity + " ชิ้น"}{parts.length <= 1 && quantity > 1 && !arranged ? " · กด Arrange เพื่อจัดเข้าพิมพ์" : ""}</span>
                {plates.length > 1 && <div className="plate-pages" role="group" aria-label="เลือกแผ่นพิมพ์">
                  <button type="button" disabled={plateIndex === 0} onClick={() => setPlateIndex(plateIndex - 1)}>แผ่นก่อนหน้า</button>
                  <button type="button" disabled={plateIndex + 1 === plates.length} onClick={() => setPlateIndex(plateIndex + 1)}>แผ่นถัดไป</button>
                </div>}
              </div>

              {support && treeSupport && <p className="overhang-guide tree-guide"><span />สีเขียวคือกิ่งซัพพอร์ต Tree Organic โดยประมาณ</p>}
              {support && overhang && !treeSupport && !tooLarge && <p className="overhang-guide">ไม่พบตำแหน่งที่ขึ้นกิ่งจากแผ่นพิมพ์ได้ในแนวนี้</p>}
              {showOverhang && <p className="overhang-guide" role="status">
                {overhang ? <><span />สีส้มคือผิวลาดลงตั้งแต่ 45° จากแนวดิ่งที่อาจต้องใช้ซัพพอร์ต</> : "ไม่พบผิว Overhang ที่เข้าข่ายในแนววางนี้"}
              </p>}
              {!toolInfo && placementMessage && <p className="overhang-guide" role="status">{placementMessage}</p>}
            </div>}
            <div className="model-actions">
              <input ref={input} type="file" multiple accept=".stl,.obj,.3mf" hidden onChange={(event) => { if (event.target.files.length) void openFiles([...event.target.files]); event.target.value = ""; }} />
              <ModelListPanel
                items={parts.length > 0
                  ? parts.map((p, idx) => {
                      const isSel = p.file === selection?.file;
                      const activeSize = isSel ? placement?.size : p.placement?.size;
                      const activeScale = isSel ? scale : p.scale;
                      return {
                        id: `${p.name}-${idx}`,
                        name: p.name,
                        file: p.file,
                        model: p.model,
                        plate: p.plate ?? 0,
                        scale: activeScale,
                        size: activeSize || p.model?.size || [0, 0, 0],
                        demo: false,
                      };
                    })
                  : selection?.demo && sample
                    ? [{
                        id: "demo-sample",
                        name: selection.name,
                        file: null,
                        model: sample,
                        plate: activePlate,
                        scale,
                        size: placement?.size || sample.size,
                        demo: true,
                      }]
                    : []}
                activePlate={activePlate}
                selectedFile={selection?.file}
                selectedDemo={Boolean(selection?.demo)}
                printSettings={printSettings}
                quantity={quantity}
                loading={loading}
                dragging={dragging}
                sampleReady={Boolean(sample)}
                onUploadClick={() => input.current.click()}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) void openFiles([...event.dataTransfer.files]); }}
                onUseDemo={useDemo}
                onSelectPart={selectPart}
                onRemovePart={removePart}
                onClearAll={clearAllParts}
                onChangeQuantity={changeQuantity}
              />
              {modelError && <p className="alert compact" role="alert">{modelError}</p>}
              {(tooLarge || invalidOther) && <p className="alert compact" role="alert">โมเดลเกินขนาดพิมพ์ {settings.buildSize.join(" × ")} มม. ในแนววางปัจจุบัน</p>}
            </div>
          </section>
          <section className="quote-panel" aria-labelledby="quote-heading">
            <div className="panel-head"><div className="panel-icon"><Calculator size={19} /></div><h2 id="quote-heading">ตั้งค่าการพิมพ์</h2></div>
            <div className="fields">
              <PrintOption label="วัสดุ" selected={material} layout="material-options" value={material} onChange={value => { setMaterial(value); setColorChoice(null); }} options={availableMaterials} />
              <PrintOption label="สี" selected={filament?.label ?? "เลือกสี"} layout="color-options" value={filament?.id} onChange={setColorChoice} options={colors} />
              {!colors.length && <p className="stock-help">วัสดุนี้ไม่มีสีพร้อมสั่งพิมพ์</p>}
              {colors.length > 0 && !filament && <p className="stock-help">สีเดิมไม่พร้อมใช้งาน กรุณาเลือกสีจากสต๊อก</p>}
              {filament && !enoughStock && <p className="stock-help">เส้นสีนี้มีไม่พอสำหรับงานนี้ ลองเลือกสีอื่นหรือลดจำนวนชุด</p>}
              <a className="stock-help" href={shopLineChatUrl} target="_blank" rel="noreferrer">สอบถามวัสดุหรือสีที่ต้องการทาง LINE ↗</a>
              <div className="quantity-row">
                <div><span id="quantity-label">จำนวนชุดพิมพ์</span><small>{selection ? `${parts.length || 1} ชิ้นต่อชุด · รวม ${(parts.length || 1) * quantity} ชิ้น` : "หนึ่งชุดรวมชิ้นงานทุกเพลต"}</small></div>
                <div className="quantity" role="group" aria-labelledby="quantity-label">
                  <button type="button" disabled={quantity <= 1} onClick={() => changeQuantity(quantity - 1)} aria-label="ลดจำนวนชุด"><Minus size={16} aria-hidden="true" /></button>
                  <output aria-live="polite">{quantity} ชุด</output>
                  <button type="button" disabled={quantity >= 100} onClick={() => changeQuantity(quantity + 1)} aria-label="เพิ่มจำนวนชุด"><Plus size={16} aria-hidden="true" /></button>
                </div>
              </div>
              <details className="advanced-print">
              <summary>ตั้งค่าขั้นสูง <small>{layerHeight.toFixed(2)} มม. · Infill {infill}% · {wallCount} ผนัง{support ? " · Support" : ""}</small></summary>
              <div className="advanced-print-fields">
              <PrintOption label="Infill (ความหนาแน่นภายใน)" selected={infill + "%"} layout="infill-options" value={infill} onChange={setInfill}
                options={infillOptions.map((percent) => ({ value: percent, label: percent + "%" }))} />
              <PrintOption label="Layer Height (ความสูงชั้น)" selected={layerHeight.toFixed(2) + " มม."} layout="layer-options" value={layerHeight} onChange={setLayerHeight} options={layerOptions} />
              <PrintOption label="Wall Count (จำนวนผนัง)" selected={wallCount} layout="wall-options" value={wallCount} onChange={setWallCount} options={wallOptions} />
              <div className="support-row">
                <label htmlFor="print-support">Support (Tree Organic)</label>
                <label className="support-toggle">
                  <input id="print-support" type="checkbox" role="switch" aria-describedby="support-description" checked={support} onChange={(event) => changeSupport(event.target.checked)} />
                  <span aria-hidden="true" className="support-track" />
                  <span aria-hidden="true">{support ? "เปิด" : "ปิด"}</span>
                </label>
              </div>
              <p id="support-description" className="support-description">Support เป็นภาพจำลองการจัดวางกิ่งรองรับ ตำแหน่งและรูปทรงที่ใช้พิมพ์จริงขึ้นกับการตั้งค่าใน Slicer</p>
              </div>
              </details>
              {warnOverhang && <div className="overhang-warning">
                <TriangleAlert size={18} aria-hidden="true" />
                <div><p role="status"><strong>ตรวจพบ Overhang</strong> ควรเปิด Support หรือปรับแนววางก่อนพิมพ์</p>
                  <div className="tool-group">
                    <button type="button" onClick={() => changeSupport(true)}>เปิด Support</button>
                    {!previewUnavailable && <button type="button" onClick={() => { setShowOverhang(true); changeView("below"); }}>ดูตำแหน่ง Overhang</button>}
                  </div>
                </div>
              </div>}
            </div>
            <div className="quote-summary" aria-labelledby="price-heading">
              <h3 id="price-heading">ราคาประเมิน</h3>
              {quote ? <dl className="price-breakdown">
                <div><dt>ปริมาตรทั้งหมด</dt><dd>{digits.format(quote.volume)} ซม.³</dd></div>
                <div><dt>น้ำหนักวัสดุ</dt><dd>{digits.format(quote.weight)} กรัม</dd></div>
                <div><dt>เวลาพิมพ์โดยประมาณ</dt><dd>{printTime(quote.minutes)}</dd></div>
                <div><dt>ค่าพิมพ์รวมดำเนินการ</dt><dd>{baht(quote.total - quote.shipping)}</dd></div>
                <div><dt>ค่าส่ง{shippingMethods.postal.name}</dt><dd>{baht(quote.shipping)}</dd></div>
              </dl> : <p>{loading ? "กำลังคำนวณจากโมเดลของคุณ" : tooLarge ? "ปรับขนาดหรือแนววางโมเดลก่อนประเมิน" : "เลือกไฟล์โมเดลเพื่อดูราคา"}</p>}
              <div className="quote-title"><span>รวมทั้งหมด{quantity > 1 ? " (" + quantity + " ชุด)" : ""}</span><output aria-live="polite">{quote ? baht(quote.total) : "—"}</output></div>
            </div>
            {quote && <details className="quote-cost-details">
              <summary>ดูรายละเอียดค่าพิมพ์</summary>
              <dl className="price-breakdown">
                <div><dt>ค่าวัสดุ</dt><dd>{baht(quote.materialCost)}</dd></div>
                <div><dt>ค่าแรงงาน</dt><dd>{baht(quote.laborCost)}</dd></div>
                <div><dt>ค่าเครื่อง</dt><dd>{baht(quote.machineCost)}</dd></div>
                <div><dt>ค่าดำเนินการ</dt><dd>{baht(quote.overhead)}</dd></div>
              </dl>
            </details>}
            <div className="estimate-note"><CircleHelp size={16} /><span>ราคาเบื้องต้นอาจเปลี่ยนตามผลจากโปรแกรม Slicer ระบบปัดเศษแต่ละรายการและยอดรวมแยกกัน</span></div>

            {quote && <div className="order-action">
              <span className="mobile-order-total"><small>ยอดประเมินรวม</small><strong>{baht(quote.total)}</strong></span>
              <button type="button" disabled={loading || !selection?.file || openingCheckout || !enoughStock} onClick={openCheckout}>{openingCheckout ? "กำลังเปิด…" : "ไปสั่งพิมพ์"}</button>
              {!selection?.file && <p>เลือกไฟล์ของคุณเพื่อสั่งพิมพ์</p>}
            </div>}
          </section>
        </div>
      </main>
    </>
  );
}
