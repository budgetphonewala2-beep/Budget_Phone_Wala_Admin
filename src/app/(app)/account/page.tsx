"use client";
import { useState } from "react";
import { Btn, Card, Field, Notice, PageHeader, inputCls } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

function Body() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 12) return setMsg({ kind: "error", text: "Use at least 12 characters." });
    if (next === current) return setMsg({ kind: "error", text: "The new password must be different." });
    if (next !== again) return setMsg({ kind: "error", text: "The two new passwords do not match." });
    setBusy(true);
    const db = supabaseBrowser();
    const { data } = await db.auth.getUser();
    const email = data.user?.email;
    if (!email) { setBusy(false); return setMsg({ kind: "error", text: "Your session ended. Sign in again." }); }
    // prove it is really the owner at the keyboard: the current password must still be right
    const re = await db.auth.signInWithPassword({ email, password: current });
    if (re.error) { setBusy(false); return setMsg({ kind: "error", text: "The current password is incorrect." }); }
    const { error } = await db.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMsg({ kind: "error", text: error.message });
    setCurrent(""); setNext(""); setAgain("");
    setMsg({ kind: "ok", text: "Password changed. Use the new one next time you sign in." });
  }

  return (
    <>
      <PageHeader title="Change password" subtitle="Use a long, unique password that you do not use anywhere else." />
      <div className="max-w-md">
        <Card>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <form onSubmit={save} className="space-y-3">
            <Field label="Current password"><input className={inputCls} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
            <Field label="New password" hint="At least 12 characters"><input className={inputCls} type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} /></Field>
            <Field label="New password again"><input className={inputCls} type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
            <Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Btn>
          </form>
        </Card>
      </div>
    </>
  );
}

export default function AccountPage() {
  return <Body />;
}
