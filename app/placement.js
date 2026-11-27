import { Box3, BufferAttribute, BufferGeometry, Euler, Quaternion, Vector3 } from "three";

const up = new Vector3(0, 0, 1);
const placementTolerance = 0.0001; // mm
export const originalOrientation = new Quaternion();
export const plateCenter = [0, 0, 0];

export function fitsPlate(size, limits) {
  return size.every((axis, index) => axis <= limits[index] + placementTolerance);
}

export function clampPlatePosition(position, size, limits, plates) {
  if (!fitsPlate(size, limits)) return plateCenter;
  const minimum = [(size[0] - limits[0]) / 2, (size[1] - limits[1]) / 2, 0];
  const maximum = [-minimum[0], -minimum[1], limits[2] - size[2]];
  for (const offsets of plates) {
    for (const [x, y] of offsets) {
      minimum[0] = Math.max(minimum[0], (size[0] - limits[0]) / 2 - x);
      minimum[1] = Math.max(minimum[1], (size[1] - limits[1]) / 2 - y);
      maximum[0] = Math.min(maximum[0], (limits[0] - size[0]) / 2 - x);
      maximum[1] = Math.min(maximum[1], (limits[1] - size[1]) / 2 - y);
    }
  }
  return minimum.map((min, axis) => Math.max(Math.min(0, min), Math.min(Math.max(0, maximum[axis]), position[axis])));
}

export function fitsPlateBounds({ min, max }, [width, depth, height]) {
  return min.x >= -width / 2 - placementTolerance && max.x <= width / 2 + placementTolerance
    && min.y >= -depth / 2 - placementTolerance && max.y <= depth / 2 + placementTolerance
    && min.z >= -placementTolerance && max.z <= height + placementTolerance;
}

export function rotatePart(orientation, axis, angle) {
  const delta = new Quaternion().setFromAxisAngle(axis, angle * Math.PI / 180);
  return orientation.clone().premultiply(delta).normalize();
}


export function rotationFromDegrees(angles) {
  const [x, y, z] = angles.map((angle) => (angle % 360) * Math.PI / 180);
  // This order applies fixed world axes in X, Y, Z order.
  return new Quaternion().setFromEuler(new Euler(x, y, z, "ZYX"));
}

export function rotationToDegrees(orientation) {
  const { x, y, z } = new Euler().setFromQuaternion(orientation, "ZYX");
  return [x, y, z].map((angle) => Math.round(angle * 180 / Math.PI * 100) / 100 || 0);
}

export function measurePlacement(model, orientation) {
  const { position } = model.geometry.attributes;
  const bounds = new Box3();
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    bounds.expandByPoint(point.fromBufferAttribute(position, i).applyQuaternion(orientation));
  }
  const center = bounds.getCenter(new Vector3());
  return {
    size: bounds.getSize(new Vector3()).toArray(),
    offset: new Vector3(-center.x, -center.y, -bounds.min.z),
  };
}

function visitFaces(model, visit) {
  const { position } = model.geometry.attributes;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), normal = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const doubleArea = normal.length();
    if (doubleArea === 0) continue;
    normal.multiplyScalar((model.winding ?? 1) / doubleArea);
    if (visit(a, b, c, normal, doubleArea / 2) === false) return false;
  }
  return true;
}

export function layFlat(model, limits) {
  const planes = new Map();
  visitFaces(model, (a, _b, _c, normal, area) => {
    const distance = normal.dot(a);
    const key = [normal.x * 2000, normal.y * 2000, normal.z * 2000, distance * 100].map(Math.round).join(",");
    const plane = planes.get(key);
    if (plane) plane.area += area;
    else planes.set(key, { normal: normal.clone(), distance, area });
  });

  const candidates = [...planes.values()].sort((a, b) => b.area - a.area).slice(0, 24);
  const down = new Vector3(0, 0, -1);
  let fallback = null;
  for (const plane of candidates) {
    const orientation = new Quaternion().setFromUnitVectors(plane.normal, down);
    const placement = measurePlacement(model, orientation);
    // An exposed face can rest on the bed only if the mesh lies on its inner side.
    if (placement.offset.z - plane.distance > 0.05) continue;
    fallback ??= orientation;
    if (fitsPlate(placement.size, limits)) return orientation;
  }
  return fallback;
}

export function arrangeCopies(size, quantity, plate, gap = 5) {
  const [width, depth] = size;
  const columns = Math.floor((plate[0] + gap + placementTolerance) / (width + gap));
  const rows = Math.floor((plate[1] + gap + placementTolerance) / (depth + gap));
  const capacity = columns * rows;
  if (!capacity) return [];

  const plates = [];
  for (let remaining = quantity; remaining > 0; remaining -= capacity) {
    const count = Math.min(capacity, remaining);
    const rowWidth = Math.min(columns, Math.ceil(Math.sqrt(count * (depth + gap) / (width + gap))));
    const perRow = Math.max(rowWidth, Math.ceil(count / rows));
    const rowCount = Math.ceil(count / perRow);
    const offsets = Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / perRow);
      const rowSize = Math.min(perRow, count - row * perRow);
      return [
        (i % perRow - (rowSize - 1) / 2) * (width + gap),
        (row - (rowCount - 1) / 2) * (depth + gap),
      ];
    });
    plates.push(offsets);
  }
  return plates;
}

function visitOverhang(model, orientation, lift, visit, angle) {
  const printUp = up.clone().applyQuaternion(orientation.clone().invert());
  const threshold = Math.cos(angle * Math.PI / 180);
  return visitFaces(model, (a, b, c, normal) => {
    if (normal.dot(printUp) > -threshold + 1e-8) return;
    if (Math.max(a.dot(printUp), b.dot(printUp), c.dot(printUp)) + lift <= 0.1) return;
    return visit(a, b, c);
  });
}

export function hasOverhang(model, orientation, lift, angle = 45) {
  return !visitOverhang(model, orientation, lift, () => false, angle);
}

export function buildOverhang(model, orientation, lift, angle = 45) {
  const positions = [];
  visitOverhang(model, orientation, lift, (a, b, c) => {
    for (const vertex of [a, b, c]) positions.push(vertex.x, vertex.y, vertex.z);
  }, angle);
  if (!positions.length) return null;
  return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
}
export function getFacePlane(model, triangle) {
  const { position } = model.geometry.attributes;
  const a = new Vector3().fromBufferAttribute(position, triangle.a);
  const normal = triangle.normal.clone().multiplyScalar(model.winding ?? 1);
  return { normal, distance: normal.dot(a) };
}

export function orientOnFace(model, current, plane) {
  const down = new Vector3(0, 0, -1);
  const normal = plane.normal.clone().applyQuaternion(current);
  const orientation = new Quaternion().setFromUnitVectors(normal, down).multiply(current).normalize();
  const placement = measurePlacement(model, orientation);
  return placement.offset.z - plane.distance <= 0.05 ? orientation : null;
}

export function buildFaceHighlight(model, plane) {
  const positions = [];
  visitFaces(model, (a, b, c, normal) => {
    if (normal.dot(plane.normal) < 0.99999 || Math.abs(plane.normal.dot(a) - plane.distance) > 0.025) return;
    for (const vertex of [a, b, c]) positions.push(vertex.x, vertex.y, vertex.z);
  });
  return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
}

