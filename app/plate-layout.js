export const maxPlates = 12;

export function plateOffset(index, bed) {
  return [(index % 2) * (bed[0] + 28), -Math.floor(index / 2) * (bed[1] + 28)];
}

export function findPlateSpot(part, neighbors, bed) {
  const [width, depth] = part.placement.size;
  const xs = [0, (width - bed[0]) / 2];
  const ys = [0, (depth - bed[1]) / 2];
  for (const neighbor of neighbors) {
    const [x, y] = neighbor.position;
    const [w, d] = neighbor.placement.size;
    xs.push(x + (w + width) / 2 + 2);
    ys.push(y + (d + depth) / 2 + 2);
  }
  for (const y of ys) {
    for (const x of xs) {
      if (Math.abs(x) + width / 2 > bed[0] / 2 || Math.abs(y) + depth / 2 > bed[1] / 2) continue;
      if (neighbors.every(other =>
        Math.abs(x - other.position[0]) >= (width + other.placement.size[0]) / 2 + 1 ||
        Math.abs(y - other.position[1]) >= (depth + other.placement.size[1]) / 2 + 1)) return [x, y, 0];
    }
  }
  return null;
}

export function placeParts(existing, incoming, start, bed) {
  const result = [...existing];
  for (const part of incoming) {
    let placed = false;
    for (let plate = start; plate < maxPlates; plate++) {
      const position = findPlateSpot(part, result.filter(other => other.plate === plate), bed);
      if (!position) continue;
      result.push({ ...part, plate, position });
      placed = true;
      break;
    }
    if (!placed) {
      if (result.some(other => other.plate === start) && part.placement.size[0] <= bed[0] && part.placement.size[1] <= bed[1]) return null;
      result.push({ ...part, plate: start, position: [0, 0, 0] });
    }
  }
  return result;
}
