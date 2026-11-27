import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Path, Shape, Vector3 } from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { unzipSync } from "fflate";

const maxFaces = 240_000;
export const maxFileSize = 20 * 1024 * 1024;

function fromGroup(group, scale = 1) {
  group.updateMatrixWorld(true);
  const meshes = [];
  group.traverse((mesh) => {
    if (mesh.isMesh) meshes.push(mesh);
  });

  const vertexCount = meshes.reduce((total, mesh) => total + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count), 0);
  if (!vertexCount || vertexCount > maxFaces * 3) throw new Error("โมเดลต้องมีพื้นผิวและมีไม่เกิน 240,000 สามเหลี่ยม");

  const positions = new Float32Array(vertexCount * 3);
  const point = new Vector3();
  let offset = 0;
  for (const mesh of meshes) {
    const { index, attributes: { position } } = mesh.geometry;
    for (let i = 0; i < (index?.count ?? position.count); i++) {
      point.fromBufferAttribute(position, index ? index.getX(i) : i)
        .applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
      point.toArray(positions, offset);
      offset += 3;
    }
  }
  return new BufferGeometry().setAttribute("position", new BufferAttribute(positions, 3));
}

function threeMfUnit(buffer) {
  const units = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
  let expanded = 0;
  const documents = unzipSync(new Uint8Array(buffer), {
    filter({ name, originalSize }) {
      expanded += originalSize;
      if (expanded > 30 * 1024 * 1024) throw new Error("ข้อมูลภายในไฟล์ 3MF มีขนาดใหญ่เกินไป");
      return name.toLowerCase().endsWith(".model");
    },
  });
  const scales = new Set(Object.values(documents).map((document) => {
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(document), "application/xml");
    const model = xml.documentElement;
    if (model.localName !== "model") throw new Error("อ่านข้อมูลภายในไฟล์ 3MF ไม่สำเร็จ");
    return units[model.getAttribute("unit") || "millimeter"];
  }));
  const [scale] = scales;
  if (scales.size !== 1 || !scale) throw new Error("ไฟล์ 3MF ต้องใช้หน่วยวัดเดียวกันทั้งไฟล์");
  return scale;
}

function analyze(geometry) {
  try {
    const position = geometry.attributes.position;
    if (!position?.count || position.count % 3 || position.count / 3 > maxFaces) {
      throw new Error("โมเดลต้องมีพื้นผิวและมีไม่เกิน 240,000 สามเหลี่ยม");
    }
    if (!position.array.every(Number.isFinite)) throw new Error("พบพิกัดผิดปกติในโมเดล");

    geometry.computeBoundingBox();
    const sourceBounds = geometry.boundingBox.clone();
    const size = geometry.boundingBox.getSize(new Vector3()).toArray();
    if (size.some((axis) => !Number.isFinite(axis) || axis <= 0)) {
      throw new Error("โมเดลต้องมีความกว้าง ความยาว และความสูง");
    }
    geometry.center();
    let area = 0;
    let signedVolume = 0;
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    const ab = new Vector3(), ac = new Vector3(), cross = new Vector3();
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      signedVolume += a.dot(cross.crossVectors(b, c)) / 6;
      area += cross.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).length() / 2;
    }
    const volume = Math.abs(signedVolume);
    if (!Number.isFinite(volume) || volume <= 0.000001 || !Number.isFinite(area)) {
      throw new Error("คำนวณปริมาตรไม่ได้ ลองตรวจว่าโมเดลปิดสนิทแล้วส่งออกใหม่");
    }
    geometry.computeVertexNormals();
    return { geometry, area, volume, size, sourceBounds, winding: Math.sign(signedVolume) };
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

export async function readModel(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["stl", "obj", "3mf"].includes(extension)) throw new Error("เลือกไฟล์ STL, OBJ หรือ 3MF");
  if (file.size > maxFileSize) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
  if (!file.size) throw new Error("ไฟล์นี้ไม่มีข้อมูล");
  const buffer = await file.arrayBuffer();
  if (extension === "stl") return analyze(new STLLoader().parse(buffer));
  if (extension === "obj") return analyze(fromGroup(new OBJLoader().parse(new TextDecoder().decode(buffer))));
  const scale = threeMfUnit(buffer);
  return analyze(fromGroup(new ThreeMFLoader().parse(buffer), scale));
}

export function demoModel() {
  const outline = new Shape();
  outline.moveTo(-27, -24);
  outline.lineTo(19, -24);
  outline.quadraticCurveTo(27, -24, 29, -16);
  outline.lineTo(34, 6);
  outline.quadraticCurveTo(36, 14, 29, 18);
  outline.lineTo(7, 31);
  outline.quadraticCurveTo(0, 35, -7, 31);
  outline.lineTo(-29, 18);
  outline.quadraticCurveTo(-36, 14, -34, 6);
  outline.lineTo(-30, -19);
  outline.quadraticCurveTo(-29, -23, -27, -24);
  for (const [x, y, radius] of [[0, 1, 13], [-21, -14, 3.1], [21, -14, 3.1], [-23, 12, 3.2], [23, 12, 3.2], [0, 24, 3]]) {
    const hole = new Path();
    hole.absarc(x, y, radius, 0, Math.PI * 2, true);
    outline.holes.push(hole);
  }
  const geometry = new ExtrudeGeometry(outline, {
    depth: 7,
    bevelThickness: 1.4,
    bevelSize: 1.2,
    bevelSegments: 3,
    curveSegments: 32,
  });
  return analyze(geometry);
}
