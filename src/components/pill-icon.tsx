import { PILL_HEX, isColor, isShape, type PillColor, type PillShape } from "@/modules/medicines/look";

/**
 * A small drawing of the medicine as it looks (shape + colour), so a glance at
 * the schedule tells them apart. Falls back to a neutral round tablet.
 */
export function PillIcon({ shape, color, size = 28, className }: { shape?: string | null; color?: string | null; size?: number; className?: string }) {
  const s: PillShape = isShape(shape) ? shape : "round";
  const c = PILL_HEX[isColor(color) ? (color as PillColor) : "white"];
  const edge = "rgba(0,0,0,.28)";
  const shine = "rgba(255,255,255,.55)";
  const body = (() => {
    switch (s) {
      case "oval":
        return <><ellipse cx="16" cy="16" rx="12" ry="7.5" fill={c} stroke={edge} /><path d="M9 16h14" stroke={edge} strokeOpacity=".5" /><ellipse cx="11" cy="13" rx="3" ry="1.3" fill={shine} /></>;
      case "capsule":
        return <g transform="rotate(-35 16 16)"><rect x="4" y="11" width="24" height="10" rx="5" fill="#f4f1ea" stroke={edge} /><path d="M16 11h7a5 5 0 0 1 0 10h-7z" fill={c} /><rect x="4" y="11" width="24" height="10" rx="5" fill="none" stroke={edge} /><rect x="7" y="13" width="6" height="2" rx="1" fill={shine} /></g>;
      case "softgel":
        return <><ellipse cx="16" cy="16" rx="11" ry="8" fill={c} fillOpacity=".85" stroke={edge} /><ellipse cx="12" cy="12.5" rx="4" ry="2" fill={shine} /></>;
      case "liquid":
        return <><rect x="11" y="4" width="10" height="4" rx="1.5" fill="#7b7f86" /><path d="M10 9h12l2 4v13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V13z" fill="#f4f1ea" stroke={edge} /><path d="M8.5 17h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" fill={c} /></>;
      case "sachet":
        return <><path d="M7 6h18v20H7z" fill={c} stroke={edge} /><path d="M7 9h18M7 23h18" stroke={edge} strokeDasharray="1.5 1.5" /><rect x="11" y="13" width="10" height="6" rx="1" fill={shine} /></>;
      case "drops":
        return <><path d="M16 4c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15z" fill={c} stroke={edge} /><ellipse cx="13" cy="18" rx="2" ry="3" fill={shine} /></>;
      case "inhaler":
        return <><rect x="9" y="4" width="9" height="16" rx="3" fill={c} stroke={edge} /><path d="M9 18h14v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2z" fill="#d8dadf" stroke={edge} /></>;
      case "injection":
        return <g transform="rotate(-40 16 16)"><rect x="9" y="12" width="14" height="8" rx="1.5" fill="#f4f1ea" stroke={edge} /><rect x="10" y="13" width="8" height="6" fill={c} /><path d="M23 16h6M5 13v6M5 16h4" stroke="#9aa0a6" strokeWidth="1.6" /></g>;
      default:
        return <><circle cx="16" cy="16" r="10.5" fill={c} stroke={edge} /><path d="M9 16h14" stroke={edge} strokeOpacity=".5" /><ellipse cx="12" cy="12" rx="3" ry="1.6" fill={shine} /></>;
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      {body}
    </svg>
  );
}
