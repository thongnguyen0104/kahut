import imageCompression from "browser-image-compression";
import { IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from "../config";
import { ApiError, api } from "./api";
import { getBrowserClient } from "./supabase";

const KEEP_GIF_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Shrinks the image (≤1280px, WebP) so phones load it fast, then uploads it
 * straight to Supabase Storage with a signed URL from our API.
 * Small GIFs are kept as-is so animations survive.
 */
export async function uploadQuizImage(file: File, quizId: string, editToken: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ApiError("bad_image_type", 400);

  let blob: Blob = file;
  const keepGif = file.type === "image/gif" && file.size <= KEEP_GIF_MAX_BYTES;
  if (!keepGif) {
    blob = await imageCompression(file, {
      maxWidthOrHeight: 1280,
      maxSizeMB: 0.6,
      fileType: "image/webp",
      initialQuality: 0.85,
      useWebWorker: true,
    });
  }

  const contentType = blob.type || "image/webp";
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(contentType)) {
    throw new ApiError("bad_image_type", 400);
  }
  if (blob.size > IMAGE_MAX_BYTES) throw new ApiError("image_too_large", 400);

  const target = await api<{ path: string; token: string; publicUrl: string }>(
    `/api/quizzes/${quizId}/upload-url`,
    { method: "POST", token: editToken, body: { contentType } },
  );

  const { error } = await getBrowserClient()
    .storage.from(IMAGE_BUCKET)
    .uploadToSignedUrl(target.path, target.token, blob, { contentType });
  if (error) throw new ApiError("upload_failed", 0);

  return target.publicUrl;
}
