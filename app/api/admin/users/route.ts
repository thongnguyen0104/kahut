import { authAdminError, parseEmail, parsePassword, parseRole, toAccountView } from "@/lib/server/accounts";
import { requireSuperadmin } from "@/lib/server/auth";
import { handle, json, readJson } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase";

/** Superadmin: every account, newest first. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireSuperadmin(req);
    const { data, error } = await getAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw authAdminError(error);
    const users = data.users
      .map(toAccountView)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ users });
  });
}

/** Superadmin: creates an account that can sign in immediately (no email confirmation). */
export async function POST(req: Request) {
  return handle(async () => {
    await requireSuperadmin(req);
    const body = await readJson(req);
    const email = parseEmail(body.email);
    const password = parsePassword(body.password);
    const role = parseRole(body.role ?? "user");

    const { data, error } = await getAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });
    if (error) throw authAdminError(error);
    return json({ user: toAccountView(data.user) }, 201);
  });
}
