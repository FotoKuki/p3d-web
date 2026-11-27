import { ArrowDownToLine, Box, Grid2X2, Move, RotateCw, ScanLine, TriangleAlert } from "lucide-react";

const icons = {
  move: Move,
  rotate: RotateCw,
  scale: ScanLine,
  face: ArrowDownToLine,
  flat: Box,
  arrange: Grid2X2,
  overhang: TriangleAlert,
};

export default function PlateIcon({ tool }) {
  const Icon = icons[tool];
  return <Icon size={30} strokeWidth={1.7} aria-hidden="true" />;
}
