"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Field, Loading, Notice, PageHeader, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime } from "@/lib/format";

async function load() {
  const db = supabaseBrowser();
  const [s, w, r] = await Promise.all([
    db.from("store_settings").select("*").eq("id", 1).single(),
    db.from("warranty_policies").select("*").order("version", { ascending: false }).limit(5),
    db.from("return_policies").select("*").order("version", { ascending: false }).limit(5),
  ]);
  for (const x of [s, w, r]) if (x.error) throw x.error;
  return { s: s.data as Row, w: (w.data ?? []) as Row[], r: (r.data ?? []) as Row[] };
}

const FIELDS: [string, string][] = [
  ["shop_name", "Shop name"], ["legal_name", "Legal name (for invoices)"], ["phone", "Phone"], ["whatsapp", "WhatsApp number (with country code)"],
  ["support_email", "Support email"], ["address", "Address"], ["opening_hours", "Opening hours"], ["gst_number", "GSTIN"], ["instagram", "Instagram URL"],
];

function Body() {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [wp, setWp] = useState<{ months: string; terms: string } | null>(null);
  const [rp, setRp] = useState<{ days: string; exclusions: string; refund: string; legal: string } | null>(null);

  if (data && !f) {
    const s = data.s;
    setF({
      ...Object.fromEntries(FIELDS.map(([k]) => [k, String(s[k] ?? "")])),
      reservation_minutes: String(s.reservation_minutes ?? ""), default_warranty_months: String(s.default_warranty_months ?? ""),
      tax_mode: String(s.tax_mode ?? "none"), tax_rate_bps: String(s.tax_rate_bps ?? 0), razorpay_capture_policy: String(s.razorpay_capture_policy ?? "automatic"),
    });
    const aw = data.w[0], ar = data.r[0];
    setWp({ months: String(aw?.months ?? s.default_warranty_months ?? 12), terms: String(aw?.terms_text ?? "") });
    setRp({ days: String(ar?.window_days ?? 7), exclusions: String(ar?.exclusions_text ?? ""), refund: String(ar?.refund_policy_text ?? ""), legal: String(ar?.legal_text ?? "") });
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: ok }); await reload(); } catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }
  const set = (k: string, v: string) => setF((p) => ({ ...(p ?? {}), [k]: v }));

  return (
    <>
      <PageHeader title="Store & policies" subtitle="Warranty and return policy wording must be approved by the owner before customers see it." />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      {loading && !data && <Loading />}
      {data && f && wp && rp && (
        <div className="space-y-5">
          <Card title="Store details">
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map(([k, l]) => <Field key={k} label={l}><input className={inputCls} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>)}
              <Field label="Reservation minutes" hint="How long a checkout holds a phone"><input className={inputCls} inputMode="numeric" value={f.reservation_minutes} onChange={(e) => set("reservation_minutes", e.target.value)} /></Field>
              <Field label="Default warranty (months)"><input className={inputCls} inputMode="numeric" value={f.default_warranty_months} onChange={(e) => set("default_warranty_months", e.target.value)} /></Field>
              <Field label="Tax mode" hint="Confirm with your accountant before changing"><select className={inputCls} value={f.tax_mode} onChange={(e) => set("tax_mode", e.target.value)}><option value="none">No tax added</option><option value="inclusive">Prices include tax</option><option value="exclusive">Tax added on top</option></select></Field>
              <Field label="Tax rate (basis points, 1800 = 18%)"><input className={inputCls} inputMode="numeric" value={f.tax_rate_bps} onChange={(e) => set("tax_rate_bps", e.target.value)} /></Field>
            </div>
            {perms.has("settings.manage") && <div className="mt-3"><Btn onClick={() => run(() => rpc("admin_update_settings", { p: {
              ...Object.fromEntries(FIELDS.map(([k]) => [k, f[k] ?? ""])),
              reservation_minutes: Number(f.reservation_minutes), default_warranty_months: Number(f.default_warranty_months),
              tax_mode: f.tax_mode, tax_rate_bps: Number(f.tax_rate_bps),
            } }), "Store settings saved.")}>Save settings</Btn></div>}
          </Card>

          <Card title="Warranty policy">
            <p className="mb-2 text-xs text-neutral-500">Current: {data.w[0] ? <>version {String(data.w[0].version)} {data.w[0].approved_at ? <Badge tone="green">Approved {dateTime(String(data.w[0].approved_at))}</Badge> : <Badge tone="amber">Not approved: customers do not see it</Badge>}</> : "none"}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Months"><input className={inputCls} inputMode="numeric" value={wp.months} onChange={(e) => setWp({ ...wp, months: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="Terms"><textarea className={inputCls} rows={4} value={wp.terms} onChange={(e) => setWp({ ...wp, terms: e.target.value })} /></Field></div>
            </div>
            {perms.has("policies.manage") && <div className="mt-3 flex gap-2">
              <Btn kind="ghost" onClick={() => run(() => rpc("admin_save_warranty_policy", { p_months: Number(wp.months), p_terms: wp.terms, p_approve: false }), "Saved as a draft version.")}>Save draft</Btn>
              {perms.has("settings.manage") && <Btn onClick={() => { if (window.confirm("Approve and publish this warranty policy to customers?")) void run(() => rpc("admin_save_warranty_policy", { p_months: Number(wp.months), p_terms: wp.terms, p_approve: true }), "Warranty policy approved and live."); }}>Approve & publish</Btn>}
            </div>}
          </Card>

          <Card title="Return & refund policy">
            <p className="mb-2 text-xs text-neutral-500">Current: {data.r[0] ? <>version {String(data.r[0].version)} {data.r[0].approved_at ? <Badge tone="green">Approved {dateTime(String(data.r[0].approved_at))}</Badge> : <Badge tone="amber">Not approved: returns stay closed</Badge>}</> : "none"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Return window (days)"><input className={inputCls} inputMode="numeric" value={rp.days} onChange={(e) => setRp({ ...rp, days: e.target.value })} /></Field>
              <Field label="Exclusions"><textarea className={inputCls} rows={3} value={rp.exclusions} onChange={(e) => setRp({ ...rp, exclusions: e.target.value })} /></Field>
              <Field label="Refund method & timing"><textarea className={inputCls} rows={3} value={rp.refund} onChange={(e) => setRp({ ...rp, refund: e.target.value })} /></Field>
              <Field label="Legal text (needs your lawyer’s review)"><textarea className={inputCls} rows={3} value={rp.legal} onChange={(e) => setRp({ ...rp, legal: e.target.value })} /></Field>
            </div>
            {perms.has("policies.manage") && <div className="mt-3 flex gap-2">
              <Btn kind="ghost" onClick={() => run(() => rpc("admin_save_return_policy", { p_window_days: Number(rp.days), p_exclusions: rp.exclusions, p_refund_text: rp.refund, p_legal: rp.legal, p_approve: false }), "Saved as a draft version.")}>Save draft</Btn>
              {perms.has("settings.manage") && <Btn onClick={() => { if (window.confirm("Approve and publish this return policy? Customers can then request returns under it.")) void run(() => rpc("admin_save_return_policy", { p_window_days: Number(rp.days), p_exclusions: rp.exclusions, p_refund_text: rp.refund, p_legal: rp.legal, p_approve: true }), "Return policy approved and live."); }}>Approve & publish</Btn>}
            </div>}
          </Card>
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  return <Guard perm="settings.manage|policies.manage"><Body /></Guard>;
}
