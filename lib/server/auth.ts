import "server-only";
import type { User } from "@supabase/supabase-js";
import type { Role } from "../accounts";
import { HttpError, bearerToken } from "./http";
import { getAdminClient } from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  isSuperadmin: boolean;
}

/** The role lives in app_metadata, which only the service role can write. */
export function roleOf(user: Pick<User, "app_metadata">): Role {
  return user.app_metadata?.role === "superadmin" ? "superadmin" : "user";
}

/**
 * Resolves the signed-in account from `Authorization: Bearer <Supabase access token>`.
 * Verified against Supabase Auth, so revoked or deleted accounts are rejected.
 */
export async function getUser(req: Request): Promise<AuthUser | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data.user) return null;
  const role = roleOf(data.user);
  return { id: data.user.id, email: data.user.email ?? "", role, isSuperadmin: role === "superadmin" };
}

export async function requireUser(req: Request): Promise<AuthUser> {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, "login_required");
  return user;
}

export async function requireSuperadmin(req: Request): Promise<AuthUser> {
  const user = await requireUser(req);
  if (!user.isSuperadmin) throw new HttpError(403, "forbidden");
  return user;
}
