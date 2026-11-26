import type { QuizSummary } from "@/lib/accounts";
import { LIMITS } from "@/lib/config";
import { requireUser } from "@/lib/server/auth";
import { check, handle, json } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase";

interface SummaryRow {
  id: string;
  title: string;
  cover_image_url: string | null;
  question_count: number;
  updated_at: string;
  owner_id: string | null;
  owner_email: string | null;
}

/** Quizzes of the signed-in account (a superadmin gets every quiz). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    let query = getAdminClient()
      .from("quizzes")
      .select("id,title,cover_image_url,question_count,updated_at,owner_id,owner_email")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (!user.isSuperadmin) query = query.eq("owner_id", user.id);

    const rows = check(await query) as SummaryRow[];
    const quizzes: QuizSummary[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      coverImageUrl: r.cover_image_url,
      questionCount: r.question_count,
      updatedAt: r.updated_at,
      ownerEmail: r.owner_email,
      mine: r.owner_id === user.id,
    }));
    return json({ quizzes });
  });
}

/** Creates an empty quiz owned by the signed-in account. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim().slice(0, LIMITS.titleMax) : "";

    const row = check(
      await getAdminClient()
        .from("quizzes")
        .insert({ title, owner_id: user.id, owner_email: user.email })
        .select("id")
        .single(),
    ) as { id: string };

    return json({ id: row.id }, 201);
  });
}
