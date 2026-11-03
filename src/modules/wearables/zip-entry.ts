/**
 * Finds one file inside a zip without reading the whole zip.
 *
 * A zip ends with a directory of its files (name, size, where it starts).
 * Reading only the last few KB tells us where the .db is; then just that
 * byte range is fetched and inflated as a stream. This works the same on a
 * Google Drive file (HTTP range requests) and on a picked file (Blob.slice),
 * so a 125 MB export never has to be held or uploaded in one piece.
 */

export type ZipEntry = { name: string; method: number; compressedSize: number; size: number; localHeaderOffset: number };
/** Reads bytes [start, end) of the zip. */
export type ReadRange = (start: number, end: number) => Promise<Uint8Array>;

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 0x100000000;

/** Every file listed in the zip's central directory. */
export async function listZip(read: ReadRange, totalSize: number): Promise<ZipEntry[]> {
  // The end record is in the last 22 bytes plus an optional comment of up to 64 KB.
  const tailLen = Math.min(totalSize, 22 + 65535 + 20);
  const tailStart = totalSize - tailLen;
  const tail = await read(tailStart, totalSize);
  let at = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === EOCD) {
      at = i;
      break;
    }
  }
  if (at < 0) throw new Error("This isn't a zip file (or it's damaged).");
  let count = u16(tail, at + 10);
  let dirSize = u32(tail, at + 12);
  let dirOffset = u32(tail, at + 16);
  // Zip64: sizes didn't fit, the real ones are in the zip64 end record.
  if (at >= 20 && u32(tail, at - 20) === ZIP64_LOCATOR) {
    const z64 = u64(tail, at - 20 + 8);
    const rec = z64 >= tailStart ? tail.subarray(z64 - tailStart, z64 - tailStart + 56) : await read(z64, z64 + 56);
    if (u32(rec, 0) === ZIP64_EOCD) {
      count = u64(rec, 32);
      dirSize = u64(rec, 40);
      dirOffset = u64(rec, 48);
    }
  }
  const dir = dirOffset >= tailStart ? tail.subarray(dirOffset - tailStart, dirOffset - tailStart + dirSize) : await read(dirOffset, dirOffset + dirSize);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder();
  let p = 0;
  for (let i = 0; i < count && p + 46 <= dir.length; i++) {
    if (u32(dir, p) !== CENTRAL) throw new Error("The zip's file list is damaged.");
    const method = u16(dir, p + 10);
    let compressedSize = u32(dir, p + 20);
    let size = u32(dir, p + 24);
    const nameLen = u16(dir, p + 28);
    const extraLen = u16(dir, p + 30);
    const commentLen = u16(dir, p + 32);
    let localHeaderOffset = u32(dir, p + 42);
    const name = dec.decode(dir.subarray(p + 46, p + 46 + nameLen));
    // Zip64 extra field (id 1) holds the 8-byte values that were set to 0xFFFFFFFF, in this order.
    let e = p + 46 + nameLen;
    const end = e + extraLen;
    while (e + 4 <= end) {
      const id = u16(dir, e);
      const len = u16(dir, e + 2);
      if (id === 1) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = u64(dir, q);
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(dir, q);
          q += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(dir, q);
      }
      e += 4 + len;
    }
    entries.push({ name, method, compressedSize, size, localHeaderOffset });
    p = end + commentLen;
  }
  return entries;
}

/** Where the entry's compressed bytes start (after its local header) and end. */
export async function entryDataRange(read: ReadRange, entry: ZipEntry): Promise<{ start: number; end: number }> {
  const h = await read(entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (u32(h, 0) !== LOCAL) throw new Error("The zip is damaged (file header not found).");
  const start = entry.localHeaderOffset + 30 + u16(h, 26) + u16(h, 28);
  return { start, end: start + entry.compressedSize };
}

/** The entry's contents as a stream: stored files pass through, deflated ones are inflated natively. */
export function inflateEntry(compressed: ReadableStream<Uint8Array>, entry: ZipEntry): ReadableStream<Uint8Array> {
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return compressed.pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  throw new Error(`The zip uses a compression method Hearth can't read (${entry.method}).`);
}
