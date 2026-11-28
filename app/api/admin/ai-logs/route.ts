import { listAiLogs } from "@/lib/server/aiLogs";
import { requireSuperadmin } from "@/lib/server/auth";
import { geminiConfigured, geminiModels } from "@/lib/server/gemini";
import { HttpError, handle, json } from "@/lib/server/http";

/** Superadmin: latest AI generation requests. `?errors=1` keeps failures only. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireSuperadmin(req);
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 500);
    try {
      const logs = await listAiLogs(limit, params.get("errors") === "1");
      return json({ logs, models: geminiModels(), configured: geminiConfigured() });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Superadmin-only route: surface the cause on the page instead of a bare server_error.
      console.error("GET /api/admin/ai-logs failed:", err);
      throw new HttpError(500, "server_error", err instanceof Error ? err.message : String(err));
    }
  });
}
