/**
 * Supabase Auth identifies accounts by an email-shaped string. The admin console asks for an "Admin ID";
 * a real email address is used as-is, anything else is mapped to a reserved, undeliverable address
 * (".invalid" can never receive mail, so no password-reset or notification can leak to a third party).
 * This is only a naming convention: access is decided by the database (staff membership + permissions).
 */
export function adminIdToEmail(input: string): string {
  const id = input.trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(id)) return id;
  const slug = id.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "admin"}@admin.invalid`;
}
