import { LIMITS } from "@/lib/config";
import { check, handle, json } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase";
import { generateToken, hashToken } from "@/lib/tokens";

/** Creates an empty quiz. The edit token is returned once and never stored in clear. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim().slice(0, LIMITS.titleMax) : "";
    const editToken = generateToken();

    const row = check(
      await getAdminClient()
        .from("quizzes")
        .insert({ title, edit_token_hash: hashToken(editToken) })
        .select("id")
        .single(),
    ) as { id: string };

    return json({ id: row.id, editToken }, 201);
  });
}
