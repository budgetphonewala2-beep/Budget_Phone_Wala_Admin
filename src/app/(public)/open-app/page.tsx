"use client";
import { useEffect, useState } from "react";

const APP_LINK = "in.budgetphonewala.app://login-callback";

// Landing page for links in emails (confirm sign-up, reset password). Email apps often refuse to open custom app links
// directly, so the email points here and this page hands the one-time code over to the BudgetPhonewala app.
// It only ever forwards to the fixed app link above, never to a link taken from the address.
export default function OpenAppPage() {
  const [target, setTarget] = useState(APP_LINK);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = qs.get("error_description") ?? hs.get("error_description") ?? qs.get("error") ?? hs.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (err) setProblem(err.replace(/\+/g, " "));
    const link = APP_LINK + window.location.search + window.location.hash;
    setTarget(link);
    if (!err) {
      const t = setTimeout(() => { window.location.href = link; }, 400);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <>
      <h1>{problem ? "This link did not work" : "Opening BudgetPhonewala…"}</h1>
      {problem ? (
        <p>{problem}. Links expire after a short time. Open the BudgetPhonewala app and request a new one.</p>
      ) : (
        <>
          <p>Your email is confirmed. If the app did not open by itself, tap the button on your phone.</p>
          <p>
            <a href={target} className="inline-block rounded-xl bg-[#D7263D] px-5 py-3 font-semibold !text-white no-underline">Open the BudgetPhonewala app</a>
          </p>
          <p className="text-sm text-neutral-500">Reading this on a computer? Just open the app on your phone and sign in with the same email and password.</p>
        </>
      )}
    </>
  );
}
