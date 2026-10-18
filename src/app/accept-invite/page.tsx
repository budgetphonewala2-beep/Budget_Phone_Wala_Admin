"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rpc, errText } from "@/lib/data";
import { Btn, Notice, Field, inputCls } from "@/components/ui";

function Accept() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setMsg(null);
    try {
      await rpc("accept_staff_invitation", { p_token: token.trim() });
      setMsg({ kind: "ok", text: "Invitation accepted. Opening the console…" });
      setTimeout(() => router.replace("/"), 800);
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Accept staff invitation</h1>
        <p className="mb-4 mt-1 text-sm text-neutral-500">
          Sign in with the account you want to use, then paste the single-use token you were given. The invitation is bound to its token, never to an email match.
        </p>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Field label="Invitation token"><input className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></Field>
        <div className="mt-3"><Btn onClick={accept} disabled={busy || !token.trim()}>Accept invitation</Btn></div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return <Suspense><Accept /></Suspense>;
}
