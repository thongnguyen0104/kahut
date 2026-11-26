import { authAdminError, parsePassword, parseRole, toAccountView } from "@/lib/server/accounts";
import { requireSuperadmin } from "@/lib/server/auth";
import { HttpError, handle, json, readJson } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase";

/** Superadmin: reset a password and/or change the role of an account. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  return handle(async () => {
    const admin = await requireSuperadmin(req);
    const { id } = await ctx.params;
    const body = await readJson(req);

    const attributes: { password?: string; app_metadata?: { role: string } } = {};
    if (body.password !== undefined) attributes.password = parsePassword(body.password);
    if (body.role !== undefined) {
      const role = parseRole(body.role);
      // Never let the last line of defence lock itself out.
      if (id === admin.id && role !== "superadmin") throw new HttpError(400, "cannot_change_own_role");
      attributes.app_metadata = { role };
    }
    if (!attributes.password && !attributes.app_metadata) throw new HttpError(400, "bad_request");

    const { data, error } = await getAdminClient().auth.admin.updateUserById(id, attributes);
    if (error) throw authAdminError(error);
    return json({ user: toAccountView(data.user) });
  });
}

/** Superadmin: delete an account. Its quizzes stay (visible to superadmins only). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  return handle(async () => {
    const admin = await requireSuperadmin(req);
    const { id } = await ctx.params;
    if (id === admin.id) throw new HttpError(400, "cannot_delete_self");
    const { error } = await getAdminClient().auth.admin.deleteUser(id);
    if (error) throw authAdminError(error);
    return json({ ok: true });
  });
}
