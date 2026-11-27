"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { Box, List, Minus, Plus, Trash2 } from "lucide-react";
import { estimate } from "./pricing";
import styles from "./model-list-panel.module.css";

const THUMB_SIZE = 128;
const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
let sharedThumbRenderer = null;

function getThumbRenderer() {
  if (sharedThumbRenderer) return sharedThumbRenderer;
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 10000);
  camera.up.set(0, 0, 1);

  scene.add(
    new AmbientLight(0xffffff, 0.7),
    new HemisphereLight(0xffffff, 0x222228, 1.9)
  );
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-140, -100, 220);
  const rim = new DirectionalLight(0xffb4b4, 1.2);
  rim.position.set(120, 220, 80);
  scene.add(key, rim);

  sharedThumbRenderer = { renderer, scene, camera };
  return sharedThumbRenderer;
}

function renderGeometryPreview(geometry, color) {
  try {
    const { renderer, scene, camera } = getThumbRenderer();
    const cloned = geometry.clone();
    const material = new MeshStandardMaterial({
      color: color || "#e5e7eb",
      roughness: 0.45,
      metalness: 0.06,
      side: DoubleSide,
    });
    try {
      cloned.computeBoundingBox();
      cloned.center();
      cloned.computeVertexNormals();
      cloned.computeBoundingSphere();
      const radius = Math.max(cloned.boundingSphere?.radius ?? 1, 0.5);

      const mesh = new Mesh(cloned, material);
      scene.add(mesh);

      const fovRad = (camera.fov * Math.PI) / 180;
      const distance = (radius / Math.sin(fovRad / 2)) * 1.2;
      camera.position.copy(new Vector3(0.72, -0.96, 0.82).normalize().multiplyScalar(distance));
      camera.near = Math.max(distance * 0.01, 0.05);
      camera.far = Math.max(distance * 20, 5000);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL("image/png");
      scene.remove(mesh);
      return dataUrl;
    } finally {
      cloned.dispose();
      material.dispose();
    }
  } catch {
    return null;
  }
}

function GeometryThumb({ geometry, color, name }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!geometry) {
      setSrc(null);
      return;
    }
    setSrc(renderGeometryPreview(geometry, color));
  }, [geometry, color]);

  return (
    <div className={styles.thumb} aria-hidden="true">
      {src ? (
        <img src={src} alt={name} width={56} height={56} />
      ) : (
        <Box size={22} className={styles.thumbFallback} />
      )}
    </div>
  );
}

export default function ModelListPanel({
  items,
  activePlate,
  selectedFile,
  selectedDemo,
  printSettings,
  quantity,
  loading,
  dragging,
  sampleReady,
  onUploadClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onUseDemo,
  onSelectPart,
  onRemovePart,
  onClearAll,
  onChangeQuantity,
}) {
  const [tab, setTab] = useState("plate");
  const colorLabel = printSettings.colorLabel;

  const plateItems = useMemo(
    () => items.filter((item) => item.demo || (item.plate ?? 0) === activePlate),
    [items, activePlate]
  );
  const visibleItems = tab === "plate" ? plateItems : items;
  const hasAny = items.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>โมเดล</h3>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.clearBtn}
            disabled={loading || !hasAny}
            onClick={onClearAll}
          >
            ล้างทั้งหมด
          </button>
          <span className={styles.listIcon} aria-hidden="true">
            <List size={16} />
          </span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="ตัวกรองรายการโมเดล">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "plate"}
          className={`${styles.tabBtn} ${tab === "plate" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("plate")}
        >
          งานนี้ · {plateItems.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={`${styles.tabBtn} ${tab === "all" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("all")}
        >
          ไฟล์ · {items.length}
        </button>
      </div>

      <button
        type="button"
        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ""}`}
        disabled={loading}
        onClick={onUploadClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Plus size={16} aria-hidden="true" />
        <span>{loading ? "กำลังอ่านโมเดล…" : "คลิกเพื่อวางไฟล์ STL / OBJ / 3MF"}</span>
      </button>

      {!hasAny && (
        <button
          type="button"
          className={styles.demoBtn}
          disabled={!sampleReady || loading}
          onClick={onUseDemo}
        >
          ลองโมเดลตัวอย่าง
        </button>
      )}

      {visibleItems.length > 0 && (
        <ul className={styles.list}>
          {visibleItems.map((item) => {
            const isSelected = item.demo ? selectedDemo : item.file === selectedFile;
            const [sx, sy, sz] = item.size || [0, 0, 0];
            const scalePct = Math.round(((item.scale?.[0] ?? 1) * 100));
            const scaledVolume =
              (item.model?.volume ?? 0) * (item.scale ? item.scale[0] * item.scale[1] * item.scale[2] : 1);
            const unitQuote =
              scaledVolume > 0 ? estimate({ volume: scaledVolume }, { ...printSettings, quantity: 1 }) : null;

            return (
              <li key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`${styles.card} ${isSelected ? styles.cardActive : ""}`}
                  onClick={() => !item.demo && onSelectPart(item.file)}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && !item.demo) {
                      event.preventDefault();
                      onSelectPart(item.file);
                    }
                  }}
                >
                  <div className={styles.cardTop}>
                    <GeometryThumb
                      geometry={item.model?.geometry}
                      color={printSettings.color}
                      name={item.name}
                    />
                    <div className={styles.cardInfo}>
                      <div className={styles.titleRow}>
                        <strong className={styles.fileName} title={item.name}>
                          {item.name}
                        </strong>
                        <button
                          type="button"
                          className={styles.trashBtn}
                          aria-label={`ลบ ${item.name}`}
                          title="ลบชิ้นงานนี้"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemovePart(item);
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <span className={styles.dims}>
                        {sx.toFixed(2)} × {sy.toFixed(2)} × {sz.toFixed(2)} mm ({scalePct}%)
                      </span>
                      <span className={styles.specs}>
                        {printSettings.material} {colorLabel} {printSettings.infill}%{" "}
                        {Number(printSettings.layerHeight).toFixed(2)} mm
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardBottom}>
                    <div className={styles.badges}>
                      <span className={styles.fdmBadge}>FDM</span>
                      {unitQuote && (
                        <span className={styles.priceBadge}>
                          ฿{money.format(unitQuote.total - unitQuote.shipping - unitQuote.overhead)}/ชิ้น · ค่าผลิต
                        </span>
                      )}
                    </div>
                    <div
                      className={styles.stepper}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={quantity <= 1}
                        aria-label="ลดจำนวนชุด"
                        onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        disabled={quantity >= 100}
                        aria-label="เพิ่มจำนวนชุด"
                        onClick={() => onChangeQuantity(Math.min(100, quantity + 1))}
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
