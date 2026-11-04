/**
 * A calorie ring: how much of a budget is eaten. Goes amber near the
 * budget and red when well over. Server-safe (plain SVG) and animates its
 * fill when it first appears.
 */
export function KcalRing({ value, goal, size = 28, stroke = 4, children, label }: { value: number; goal: number | null; size?: number; stroke?: number; children?: React.ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal ? value / goal : 0;
  const shown = Math.min(1, pct);
  const color = !goal ? "var(--fg-muted)" : pct > 1.15 ? "var(--danger)" : pct > 0.95 ? "var(--sun)" : "var(--cat-food)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--arc-track)" strokeWidth={stroke} />
        {goal && value > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - shown)}
            style={{ ["--ring-from" as string]: `${c}`, ["--ring-to" as string]: `${c * (1 - shown)}`, animation: "ring-fill .8s cubic-bezier(.3,.8,.3,1) both" }}
          />
        ) : null}
      </svg>
      {children ? <span className="absolute inset-0 grid place-items-center text-center">{children}</span> : null}
    </span>
  );
}
