import {
  CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, SphereGeometry, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const spacing = 12; // mm between sampled contacts
const maxContacts = 42;
const tipGap = 0.78; // allow clearance for the radius of a tilted branch tip
const up = new Vector3(0, 0, 1);

function findContacts(overhang, orientation, offset) {
  const { position } = overhang.attributes;
  const cells = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), center = new Vector3();
  function sample(x, y, z, onGrid) {
    if (z <= 1) return;
    const key = Math.floor(x / spacing) + "," + Math.floor(y / spacing);
    const previous = cells.get(key);
    if (!previous || (onGrid && !previous.onGrid) || (onGrid === previous.onGrid && z < previous.point.z)) {
      cells.set(key, { point: new Vector3(x, y, z), onGrid });
    }
  }

  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i).applyQuaternion(orientation).add(offset);
    b.fromBufferAttribute(position, i + 1).applyQuaternion(orientation).add(offset);
    c.fromBufferAttribute(position, i + 2).applyQuaternion(orientation).add(offset);
    center.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    sample(center.x, center.y, center.z, false);

    const determinant = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(determinant) < 1e-8) continue;
    const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y), maxY = Math.max(a.y, b.y, c.y);
    for (let x = (Math.ceil(minX / spacing - 0.5) + 0.5) * spacing; x <= maxX; x += spacing) {
      for (let y = (Math.ceil(minY / spacing - 0.5) + 0.5) * spacing; y <= maxY; y += spacing) {
        const u = ((x - a.x) * (c.y - a.y) - (y - a.y) * (c.x - a.x)) / determinant;
        const v = ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / determinant;
        if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
          sample(x, y, a.z + u * (b.z - a.z) + v * (c.z - a.z), true);
        }
      }
    }
  }

  const contacts = [...cells.values()].map(({ point }) => point).sort((a, b) => a.y - b.y || a.x - b.x);
  const stride = Math.max(1, Math.ceil(contacts.length / maxContacts));
  return contacts.filter((_, index) => index % stride === 0);
}

function taperedBranch(start, end, baseRadius, tipRadius) {
  const direction = end.clone().sub(start);
  const geometry = new CylinderGeometry(tipRadius, baseRadius, direction.length(), 9);
  geometry.rotateX(Math.PI / 2);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(up, direction.normalize()));
  const center = start.clone().lerp(end, 0.5);
  return geometry.translate(center.x, center.y, center.z);
}

export function buildTreeSupport(model, overhang, orientation, placement) {
  if (!overhang) return null;
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(model.geometry, material);
  mesh.position.copy(placement.offset);
  mesh.quaternion.copy(orientation);
  mesh.updateMatrixWorld(true);

  const ray = new Raycaster();
  const direction = new Vector3();
  function clear(start, end) {
    direction.subVectors(end, start);
    ray.far = direction.length();
    ray.set(start, direction.normalize());
    return ray.intersectObject(mesh, false).length === 0;
  }

  const contacts = findContacts(overhang, orientation, placement.offset)
    .map((point) => point.addScaledVector(up, -tipGap))
    .filter((point) => clear(point, new Vector3(point.x, point.y, 0.04)));
  const parts = [];
  const root = new Vector3();
  const remaining = contacts.slice();
  while (remaining.length) {
    const contact = remaining.shift();
    const nearby = remaining.filter((point) => Math.hypot(point.x - contact.x, point.y - contact.y) <= 30
      && Math.abs(point.z - contact.z) <= 20).slice(0, 4);
    const group = [contact, ...nearby];
    const junction = group.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / group.length);
    junction.z = Math.min(...group.map((point) => point.z)) * 0.53;
    root.set(junction.x, junction.y, 0);
    const canMerge = nearby.length > 0 && junction.z >= 3 && clear(junction, root) && group.every((tip) =>
      Math.hypot(tip.x - junction.x, tip.y - junction.y) <= tip.z - junction.z && clear(junction, tip));

    if (canMerge) {
      for (const tip of nearby) remaining.splice(remaining.indexOf(tip), 1);
      const radius = Math.min(3.7, 1.5 + group.length * 0.42);
      parts.push(taperedBranch(root, junction, radius + 0.7, radius));
      parts.push(new SphereGeometry(radius, 10, 7).translate(junction.x, junction.y, junction.z));
      for (const tip of group) parts.push(taperedBranch(junction, tip, radius * 0.73, 0.75));
    } else {
      root.set(contact.x, contact.y, 0);
      parts.push(taperedBranch(root, contact, Math.min(2.7, 1.2 + contact.z * 0.025), 0.7));
    }
  }

  material.dispose();
  if (!parts.length) return null;
  const tree = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return tree;
}