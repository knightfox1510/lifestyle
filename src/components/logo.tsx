import { cx } from "@/components/ui";

/** Hearth mark: a home holding a two-tipped flame with a heart at its core. */
export function LogoMark({ className, title = "Hearth" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#357a67" />
          <stop offset="1" stopColor="#25594b" />
        </linearGradient>
        <linearGradient id="logo-flame" x1="0" y1="1" x2="0.2" y2="0">
          <stop offset="0" stopColor="#e2674c" />
          <stop offset="0.55" stopColor="#f08a4b" />
          <stop offset="1" stopColor="#f7bd57" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#logo-bg)" />
      <path d="M256 102 L414 228 Q424 236 424 249 V388 Q424 414 398 414 H114 Q88 414 88 388 V249 Q88 236 98 228 Z" fill="#f8f3e9" stroke="#f8f3e9" strokeWidth="10" strokeLinejoin="round" />
      <path d="M256 384 C204 384 172 349 172 305 C172 262 207 236 224 204 C231 229 243 244 256 252 C262 225 277 196 302 172 C308 212 340 246 340 302 C340 349 307 384 256 384 Z" fill="url(#logo-flame)" />
      <path d="M256 352 C232 337 216 322 216 303 C216 290 226 281 238 281 C246 281 252 286 256 293 C260 286 266 281 274 281 C286 281 296 290 296 303 C296 322 280 337 256 352 Z" fill="#fff5e4" />
    </svg>
  );
}

/** Mark + wordmark. */
export function Logo({ size = "md", tagline }: { size?: "sm" | "md" | "lg"; tagline?: string }) {
  const mark = { sm: "size-8", md: "size-10", lg: "size-16" }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={cx(mark, "shrink-0 drop-shadow-sm")} />
      <span className="min-w-0">
        <span className={cx("block font-semibold leading-tight tracking-tight", text)}>Hearth</span>
        {tagline ? <span className="block truncate text-xs text-fg-muted">{tagline}</span> : null}
      </span>
    </span>
  );
}
