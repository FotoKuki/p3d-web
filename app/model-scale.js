import { Vector3 } from "three";

export const originalScale = [1, 1, 1];

export function isValidModelScale(model, scale) {
  if (!Array.isArray(scale) || scale.length !== 3) return false;
  const volume = model.volume * scale[0] * scale[1] * scale[2];
  return Number.isFinite(volume) && volume > 0.000001 && scale.every((factor, axis) => {
    const size = Math.fround(model.size[axis] * factor);
    return Number.isFinite(factor) && factor > 0 && Number.isFinite(size) && size > 0;
  });
}

export function scaleModel(model, scale) {
  if (scale.every((factor) => factor === 1)) return model;
  const geometry = model.geometry.clone().scale(...scale);
  return {
    geometry,
    size: geometry.boundingBox.getSize(new Vector3()).toArray(),
    volume: model.volume * scale[0] * scale[1] * scale[2],
    winding: model.winding,
  };
}
