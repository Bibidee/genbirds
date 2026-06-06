// Visual slingshot drawn via SVG overlay (the canvas draws gameplay).
import { SLING } from "@/lib/physics";
export default function Slingshot({ scale }: { scale: number }) {
  const x = SLING.x * scale, y = SLING.y * scale;
  return (
    <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 1200 640" preserveAspectRatio="none">
      <rect x={SLING.x - 8} y={SLING.y} width="16" height="120" fill="#7a4a1f" rx="6" />
      <rect x={SLING.x - 14} y={SLING.y - 6} width="28" height="12" fill="#7a4a1f" rx="4" />
    </svg>
  );
}
