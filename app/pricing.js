import { shippingMethods } from "../lib/shipping-options";

export const materials = {
  PLA: { description: "ใช้งานทั่วไป", density: 1.24, bahtPerGram: 3.5, speedFactor: 1 },
  PETG: { description: "ทนทาน ยืดหยุ่น", density: 1.27, bahtPerGram: 2.5, speedFactor: 0.85 },
  ABS: { description: "ทนความร้อน", density: 1.04, bahtPerGram: 4, speedFactor: 0.9 },
  ASA: { description: "ทน UV เหมาะกับงานกลางแจ้ง", density: 1.07, bahtPerGram: 4.5, speedFactor: 0.85 },
  TPU: { description: "ยืดหยุ่นสูง", density: 1.21, bahtPerGram: 4, speedFactor: 0.6 },
};

export const settings = {
  buildSize: [255, 255, 255], // mm
  wallFractionPerWall: 0.08,
  referenceLayerHeight: 0.2, // mm
  referencePrintRate: 14.4, // cm³ per hour
  supportTimeMultiplier: 1.15,
  laborFraction: 0.3,
  machineHourlyRate: 25,
  overhead: 30,
};

export function estimate(model, { material, layerHeight, infill, wallCount, support, quantity }, delivery = "postal") {
  const rate = materials[material];
  const totalVolume = model.volume * quantity / 1000; // mm³ to cm³
  const shellFraction = wallCount * settings.wallFractionPerWall;
  const printedVolume = totalVolume * (shellFraction + (1 - shellFraction) * infill / 100);
  const weight = printedVolume * rate.density;
  const printRate = settings.referencePrintRate * (layerHeight / settings.referenceLayerHeight) * rate.speedFactor;
  const hours = printedVolume / printRate * (support ? settings.supportTimeMultiplier : 1);

  const materialCost = weight * rate.bahtPerGram;
  const laborCost = materialCost * settings.laborFraction;
  const machineCost = hours * settings.machineHourlyRate;
  const overhead = settings.overhead;
  const shipping = shippingMethods[delivery].fee;

  // Match the previous estimator: round each displayed value and round the total independently.
  return {
    volume: Math.round(totalVolume),
    weight: Math.round(weight),
    minutes: Math.round(hours * 60),
    materialCost: Math.round(materialCost),
    laborCost: Math.round(laborCost),
    machineCost: Math.round(machineCost),
    overhead,
    shipping,
    total: Math.round(materialCost + laborCost + machineCost + overhead + shipping),
  };
}