import { randomUUID } from "node:crypto";
import { IMAGE_BUCKET, IMAGE_MIME_TYPES } from "@/lib/config";
import { HttpError, bearerToken, handle, json, readJson } from "@/lib/server/http";
import { getEditableQuiz } from "@/lib/server/quizzes";
import { getAdminClient } from "@/lib/server/supabase";

const EXTENSIONS: Record<(typeof IMAGE_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Issues a one-time signed upload URL for an image of this quiz.
 * The browser then uploads straight to Supabase Storage.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/quizzes/[id]/upload-url">) {
  return handle(async () => {
    const { id } = await ctx.params;
    await getEditableQuiz(id, bearerToken(req));

    const { contentType } = await readJson(req);
    if (typeof contentType !== "string" || !(contentType in EXTENSIONS)) {
      throw new HttpError(400, "bad_image_type");
    }
    const ext = EXTENSIONS[contentType as keyof typeof EXTENSIONS];
    const path = `${id}/${randomUUID()}.${ext}`;

    const storage = getAdminClient().storage.from(IMAGE_BUCKET);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error) throw error;

    const publicUrl = storage.getPublicUrl(path).data.publicUrl;
    return json({ path: data.path, token: data.token, publicUrl });
  });
}
