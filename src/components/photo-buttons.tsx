"use client";

import { Camera, ImageUp } from "lucide-react";
import { cx } from "@/components/ui";

/**
 * Two clear choices wherever a photo is used: take a new one with the camera,
 * or pick one (or a file) already on the phone/computer.
 */
export function PhotoButtons({
  onFiles,
  disabled,
  multiple,
  accept = "image/*",
  cameraLabel = "Take photo",
  uploadLabel = "Upload",
  compact,
  className,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  /** What "Upload" accepts (e.g. "image/*,application/pdf"); the camera is always a photo. */
  accept?: string;
  cameraLabel?: string;
  uploadLabel?: string;
  /** Icon-only buttons (with labels for screen readers). */
  compact?: boolean;
  className?: string;
}) {
  const btn = cx(
    "pressable inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-surface text-sm font-medium hover:bg-surface-2",
    compact ? "size-10" : "h-10 px-4",
    disabled && "pointer-events-none opacity-50",
  );
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length) onFiles(files);
  };
  return (
    <span className={cx("inline-flex flex-wrap gap-2", className)}>
      <label className={btn} title={cameraLabel}>
        <Camera className="size-4" aria-hidden />
        {compact ? <span className="sr-only">{cameraLabel}</span> : cameraLabel}
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={handle} />
      </label>
      <label className={btn} title={uploadLabel}>
        <ImageUp className="size-4" aria-hidden />
        {compact ? <span className="sr-only">{uploadLabel}</span> : uploadLabel}
        <input type="file" accept={accept} multiple={multiple} className="sr-only" disabled={disabled} onChange={handle} />
      </label>
    </span>
  );
}
