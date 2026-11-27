"use client";

import { useEffect, useRef, useState } from "react";
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
import { unzipSync } from "fflate";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { Box } from "lucide-react";
import styles from "./admin-orders.module.css";

const THUMB_SIZE = 160;
const previewCache = new Map();
let sharedRenderer = null;
let renderQueue = Promise.resolve();

function getRenderer() {
  if (sharedRenderer) return sharedRenderer;
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 10000);
  camera.up.set(0, 0, 1);

  scene.add(
    new AmbientLight(0xadcfff, 0.65),
    new HemisphereLight(0xe4f5ff, 0x153f62, 2.0)
  );
  const key = new DirectionalLight(0xffffff, 2.3);
  key.position.set(-140, -100, 220);
  const rim = new DirectionalLight(0x5fd6ff, 1.9);
  rim.position.set(120, 220, 80);
  scene.add(key, rim);

  sharedRenderer = { renderer, scene, camera, loader: new STLLoader() };
  return sharedRenderer;
}

function resolveColor(color) {
  return typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color.trim())
    ? color.trim()
    : "#8caeff";
}

function renderStlBuffer(buffer, color) {
  const { renderer, scene, camera, loader } = getRenderer();
  const geometry = loader.parse(buffer);
  const material = new MeshStandardMaterial({
    color: resolveColor(color),
    roughness: 0.42,
    metalness: 0.08,
    side: DoubleSide,
  });

  try {
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) throw new Error("Empty geometry");
    geometry.center();
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const radius = Math.max(geometry.boundingSphere?.radius ?? 0.5, 0.5);

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = (radius / Math.sin(fovRad / 2)) * 1.18;
    const dir = new Vector3(0.72, -0.96, 0.82).normalize();
    camera.position.copy(dir.multiplyScalar(distance));
    camera.near = Math.max(distance * 0.01, 0.05);
    camera.far = Math.max(distance * 20, 5000);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL("image/png");
    scene.remove(mesh);
    return dataUrl;
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

async function loadThumbnail(orderId, color, modelUrl, signal) {
  const url = modelUrl || `/admin/orders/${orderId}/model`;
  const key = `${url}|${color || ""}`;
  if (previewCache.has(key)) return previewCache.get(key);

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Failed to load model");
  let buffer = await response.arrayBuffer();
  const signature = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
  if (signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 3 && signature[3] === 4) {
    let found = false;
    const files = unzipSync(new Uint8Array(buffer), { filter: file => {
      if (found || !/^plate-\d+\.stl$/.test(file.name)) return false;
      found = true;
      return true;
    } });
    const [first] = Object.values(files);
    if (!first) return null;
    buffer = first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength);
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const dataUrl = await new Promise((resolve, reject) => {
    renderQueue = renderQueue
      .catch(() => {})
      .then(() => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        try {
          resolve(renderStlBuffer(buffer, color));
        } catch (err) {
          reject(err);
        }
      });
  });

  previewCache.set(key, dataUrl);
  return dataUrl;
}

export default function StlThumbnail({ orderId, fileName, color, modelUrl }) {
  const hostRef = useRef(null);
  const url = modelUrl || `/admin/orders/${orderId}/model`;
  const cacheKey = `${url}|${color || ""}`;
  const [src, setSrc] = useState(() => previewCache.get(cacheKey) || null);
  const [status, setStatus] = useState(() => (previewCache.has(cacheKey) ? "ready" : "idle"));

  useEffect(() => {
    if (previewCache.has(cacheKey)) {
      setSrc(previewCache.get(cacheKey));
      setStatus("ready");
      return;
    }

    const element = hostRef.current;
    if (!element) return;

    const controller = new AbortController();
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      setStatus("loading");
      loadThumbnail(orderId, color, url, controller.signal)
        .then((dataUrl) => {
          setSrc(dataUrl);
          setStatus("ready");
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setStatus("error");
        });
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => controller.abort();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [orderId, color, url, cacheKey]);

  const swatch = typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color.trim()) ? color.trim() : null;

  return (
    <div
      ref={hostRef}
      className={styles.thumbFrame}
      aria-label={`ตัวอย่างโมเดล ${fileName}`}
    >
      {src ? (
        <img
          src={src}
          alt={`ตัวอย่าง 3 มิติของ ${fileName}`}
          className={styles.thumbImage}
          width={80}
          height={80}
        />
      ) : (
        <div className={status === "loading" ? styles.thumbLoading : styles.thumbFallback} aria-hidden="true">
          <Box size={24} />
        </div>
      )}
      {swatch && <span className={styles.colorDot} style={{ background: swatch }} title={`สี ${swatch}`} />}
    </div>
  );
}
