// Phone cameras produce 3-12 MB photos but the storage bucket accepts 5 MB per file. Every photo is resized and re-encoded in the
// browser first (long side 1600 px, JPEG), so any normal photo uploads and loads fast in the app.
const MAX_SIDE = 1600;
const MAX_BYTES = 4 * 1024 * 1024;

export type PreparedImage = { blob: Blob; type: "image/jpeg"; ext: "jpg" };

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error(`${file.name}: this is not a photo`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: this photo format cannot be read here. Use a JPG, PNG or WebP photo (iPhone HEIC photos: share as JPG).`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`${file.name}: could not process the photo`);
  ctx.fillStyle = "#ffffff"; // PNG transparency becomes white instead of black
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const q of [0.86, 0.78, 0.68, 0.56]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= MAX_BYTES) return { blob, type: "image/jpeg", ext: "jpg" };
  }
  throw new Error(`${file.name}: the photo is still too large after shrinking`);
}
