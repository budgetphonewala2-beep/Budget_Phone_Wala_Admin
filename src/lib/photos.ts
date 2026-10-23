import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareImage } from "@/lib/images";

// Product photos are served by the bpw-photos Cloudflare worker (R2 storage, no download charge). When PHOTOS_URL is empty
// the console falls back to the Supabase "product-images" bucket, which is what older photos still use.
export const PHOTOS_URL = (process.env.NEXT_PUBLIC_PHOTOS_URL ?? "").replace(/\/$/, "");

export type StoredPhoto = { storage_path: string; thumb_path: string | null };

/** Public URL for a stored photo: a full https URL (R2) is used as is, a bucket path goes through Supabase Storage. */
export function photoUrl(db: SupabaseClient, path: string): string {
  return path.startsWith("https://") ? path : db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

async function put(token: string, key: string, blob: Blob) {
  const r = await fetch(`${PHOTOS_URL}/img/${key}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: blob });
  if (!r.ok) throw new Error(r.status === 403 ? "You do not have permission to upload photos" : `Photo upload failed (${r.status})`);
}

/** Shrinks the photo, makes a thumbnail and stores both. Returns the values for product_images. */
export async function uploadProductPhoto(db: SupabaseClient, modelId: string, file: File): Promise<StoredPhoto> {
  const full = await prepareImage(file);
  const id = crypto.randomUUID();
  if (!PHOTOS_URL) {
    const path = `models/${modelId}/${id}.${full.ext}`;
    const up = await db.storage.from("product-images").upload(path, full.blob, { contentType: full.type, upsert: false });
    if (up.error) throw up.error;
    return { storage_path: path, thumb_path: null };
  }
  const thumb = await prepareImage(file, 480);
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your sign-in expired. Sign in again and retry.");
  const key = `models/${modelId}/${id}`;
  await put(token, `${key}.jpg`, full.blob);
  await put(token, `${key}_t.jpg`, thumb.blob);
  return { storage_path: `${PHOTOS_URL}/img/${key}.jpg`, thumb_path: `${PHOTOS_URL}/img/${key}_t.jpg` };
}

/** Removes the stored files of a photo row (the row itself is deleted by the caller). Failures are ignored: an orphan file is harmless. */
export async function removeProductPhoto(db: SupabaseClient, row: Record<string, unknown>) {
  const path = String(row.storage_path);
  if (!path.startsWith("https://")) {
    await db.storage.from("product-images").remove([path]);
    return;
  }
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  for (const p of [path, row.thumb_path ? String(row.thumb_path) : null]) {
    if (p && token) await fetch(p, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  }
}
