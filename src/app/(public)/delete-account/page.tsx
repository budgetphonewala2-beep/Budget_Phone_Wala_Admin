"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { errText } from "@/lib/data";
import { Btn, Field, Notice, inputCls } from "@/components/ui";

type Stage = "loading" | "signed-out" | "signed-in" | "requested";

// Web resource for "Delete account" (Google Play requirement): a customer of the BudgetPhonewala app can ask for
// deletion of their account and data here without opening the app. Identity is proven by signing in.
export default function DeleteAccountPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedEmail, setSignedEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => {
      if (data.user) { setSignedEmail(data.user.email ?? ""); setStage("signed-in"); } else setStage("signed-out");
    });
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg({ kind: "error", text: "Email or password is incorrect." });
    setSignedEmail(data.user?.email ?? "");
    setStage("signed-in");
  }

  async function google() {
    setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/delete-account` },
    });
    if (error) setMsg({ kind: "error", text: error.message });
  }

  async function requestDeletion() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabaseBrowser().rpc("request_account_deletion");
    setBusy(false);
    if (error) return setMsg({ kind: "error", text: errText(error) });
    await supabaseBrowser().auth.signOut();
    setStage("requested");
  }

  return (
    <>
      <h1>Delete your BudgetPhonewala account</h1>
      <p>
        This page is for customers of the <strong>BudgetPhonewala</strong> app. You can ask us to delete your account and the personal data linked to it
        without opening the app.
      </p>

      <h2>What happens</h2>
      <ul>
        <li>We remove or anonymise your name, email, mobile number, saved addresses, wishlist, cart, notification settings and photos you sent with enquiries.</li>
        <li>Your sign-in is disabled so the account cannot be used again.</li>
        <li>Order, payment and invoice records may have to be kept for accounting and tax law. They are kept without your name and contact details where the law allows.</li>
        <li>We complete requests within 30 days (usually much sooner). You may be contacted to confirm an open order or return first.</li>
      </ul>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      {stage === "loading" && <p className="text-neutral-500">Loading…</p>}

      {stage === "signed-out" && (
        <section aria-label="Sign in to continue" className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="!mt-0">Sign in to confirm it is you</h2>
          <form onSubmit={signIn} className="space-y-3">
            <Field label="Email"><input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <div className="flex flex-wrap items-center gap-3">
              <Btn type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
              <button type="button" onClick={google} className="text-sm font-semibold underline">Continue with Google</button>
            </div>
          </form>
          <p className="mt-4 text-sm text-neutral-600">
            Cannot sign in? Email <a href="mailto:budgetphonewala2@gmail.com?subject=Delete%20my%20BudgetPhonewala%20account">budgetphonewala2@gmail.com</a> from the
            address on your account, or call +91 98500 07981, and we will handle the request.
          </p>
        </section>
      )}

      {stage === "signed-in" && (
        <section aria-label="Confirm deletion" className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p>Signed in as <strong>{signedEmail}</strong>.</p>
          <label className="my-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I understand my account and personal data will be deleted and this cannot be undone.</span>
          </label>
          <Btn kind="danger" disabled={!confirmed || busy} onClick={requestDeletion}>{busy ? "Sending…" : "Request account deletion"}</Btn>
        </section>
      )}

      {stage === "requested" && (
        <Notice kind="ok">Your deletion request has been received. We will process it within 30 days and you have been signed out. Thank you for shopping with BudgetPhonewala.</Notice>
      )}
    </>
  );
}
