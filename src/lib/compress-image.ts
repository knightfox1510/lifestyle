"use client";

/**
 * Shrinks a photo/screenshot in the browser before upload (Vercel functions
 * accept ~4.5 MB per request). Long screenshots keep enough resolution for
 * menu text. Falls back to the original file if the browser can't decode it
 * (e.g. some HEIC files on non-Apple browsers).
 */
export async function compressImage(file: File, maxSide = 2048, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Total upload budget for one request, leaving room for form fields. */
export const MAX_UPLOAD_BYTES = 4_200_000;
