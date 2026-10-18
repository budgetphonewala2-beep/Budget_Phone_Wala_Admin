"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { adminIdToEmail } from "@/lib/adminId";
import { Btn, Field, Notice, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const db = supabaseBrowser();
    const { error: err } = await db.auth.signInWithPassword({ email: adminIdToEmail(adminId), password });
    if (err) {
      setBusy(false);
      // one message for every failure so the form never reveals which part was wrong
      return setError("Admin ID or password is incorrect.");
    }
    // a valid account that is not active staff gets no console access at all
    const { data: perms } = await db.rpc("my_permissions");
    if (!Array.isArray(perms) || perms.length === 0) {
      await db.auth.signOut();
      setBusy(false);
      return setError("Admin ID or password is incorrect.");
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#D7263D]">BudgetPhonewala Admin</h1>
        <p className="mb-4 mt-1 text-sm text-neutral-500">Authorised staff only.</p>
        {error && <Notice>{error}</Notice>}
        <form onSubmit={signIn} className="space-y-3">
          <Field label="Admin ID">
            <input className={inputCls} autoComplete="username" required value={adminId} onChange={(e) => setAdminId(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Btn type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
        </form>
      </div>
    </div>
  );
}
