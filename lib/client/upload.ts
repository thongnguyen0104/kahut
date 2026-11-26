import imageCompression from "browser-image-compression";
import { AUDIO_MAX_BYTES, AUDIO_MIME_TYPE, IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from "../config";
import { ApiError } from "./api";
import { authApi } from "./auth";
import { getBrowserClient } from "./supabase";

const KEEP_GIF_MAX_BYTES = 2 * 1024 * 1024;

/** Uploads straight to Supabase Storage with a signed URL from our API; returns the public URL. */
async function uploadToStorage(blob: Blob, contentType: string, quizId: string, failCode: string): Promise<string> {
  const target = await authApi<{ path: string; token: string; publicUrl: string }>(
    `/api/quizzes/${quizId}/upload-url`,
    { method: "POST", body: { contentType } },
  );

  const { error } = await getBrowserClient()
    .storage.from(IMAGE_BUCKET)
    .uploadToSignedUrl(target.path, target.token, blob, { contentType });
  if (error) throw new ApiError(failCode, 0);

  return target.publicUrl;
}

/**
 * Shrinks the image (≤1280px, WebP) so phones load it fast, then uploads it.
 * Small GIFs are kept as-is so animations survive.
 */
export async function uploadQuizImage(file: File, quizId: string): Promise<string> {
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

  return uploadToStorage(blob, contentType, quizId, "upload_failed");
}

/** Uploads an .mp3 as-is (browsers report it as audio/mpeg, audio/mp3, or nothing at all). */
export async function uploadQuizAudio(file: File, quizId: string): Promise<string> {
  const isMp3 = ["audio/mpeg", "audio/mp3", "audio/x-mp3", "audio/mpeg3"].includes(file.type) || /\.mp3$/i.test(file.name);
  if (!isMp3) throw new ApiError("bad_audio_type", 400);
  if (file.size > AUDIO_MAX_BYTES) throw new ApiError("audio_too_large", 400);
  // Re-wrap so the multipart body carries the type the bucket allows.
  const blob = new Blob([file], { type: AUDIO_MIME_TYPE });
  return uploadToStorage(blob, AUDIO_MIME_TYPE, quizId, "audio_upload_failed");
}
