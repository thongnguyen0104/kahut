import { listAiLogs } from "@/lib/server/aiLogs";
import { requireSuperadmin } from "@/lib/server/auth";
import { geminiConfigured, geminiModels } from "@/lib/server/gemini";
import { handle, json } from "@/lib/server/http";

/** Superadmin: latest AI generation requests. `?errors=1` keeps failures only. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireSuperadmin(req);
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 500);
    const logs = await listAiLogs(limit, params.get("errors") === "1");
    return json({ logs, models: geminiModels(), configured: geminiConfigured() });
  });
}
