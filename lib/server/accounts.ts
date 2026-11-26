import "server-only";
import type { User } from "@supabase/supabase-js";
import { PASSWORD_MIN_LENGTH, ROLES, type AccountView, type Role } from "../accounts";
import { roleOf } from "./auth";
import { HttpError } from "./http";

export function toAccountView(user: User): AccountView {
  return {
    id: user.id,
    email: user.email ?? "",
    role: roleOf(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

export function parseRole(value: unknown): Role {
  if (!ROLES.includes(value as Role)) throw new HttpError(400, "bad_request");
  return value as Role;
}

export function parsePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(400, "weak_password");
  }
  return value;
}

export function parseEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "invalid_email");
  return email;
}

/** Turns a Supabase Auth admin error into a translatable API error. */
export function authAdminError(error: { code?: string; status?: number; message: string }): HttpError {
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return new HttpError(409, "email_taken");
    case "weak_password":
      return new HttpError(400, "weak_password");
    case "user_not_found":
      return new HttpError(404, "user_not_found");
    case "email_address_invalid":
    case "validation_failed":
      return new HttpError(400, "invalid_email");
  }
  console.error("auth admin error", error);
  return new HttpError(500, "server_error");
}
