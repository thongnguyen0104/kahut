/**
 * Creates an account, or updates its password/role if the email already exists.
 * Used to bootstrap the first superadmin (later accounts are made in /admin/users).
 *
 *   npm run create-user -- --email admin@example.com --password <password> --role superadmin
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local or the shell).
 */
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../lib/supabaseUrl";

try {
  process.loadEnvFile(".env.local");
} catch {
  // rely on the real environment
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
const role = arg("role") ?? "user";
const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || !["user", "superadmin"].includes(role)) {
  console.error("Usage: --email <email> --password <password> [--role user|superadmin]");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main(email: string, password: string) {
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

  const created = await admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (!created.error) {
    console.log(`✔ Created ${email} (${role})`);
    return;
  }
  if (created.error.code !== "email_exists" && created.error.code !== "user_already_exists") {
    throw new Error(`Create failed: ${created.error.code} ${created.error.message}`);
  }

  const { data, error } = await admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (error || !existing) throw new Error(`Account exists but could not be found: ${error?.message ?? ""}`);

  const updated = await admin.updateUserById(existing.id, { password, app_metadata: { role } });
  if (updated.error) throw new Error(`Update failed: ${updated.error.message}`);
  console.log(`✔ Updated ${email}: password reset, role ${role}`);
}

main(email, password).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
