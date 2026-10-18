"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, rupees, toPaise } from "@/lib/format";

type CouponForm = { id?: string; code: string; type: "flat" | "percent"; value: string; max: string; min: string; expires: string; total: string; perUser: string; active: boolean };
const blank: CouponForm = { code: "", type: "percent", value: "", max: "", min: "", expires: "", total: "", perUser: "1", active: true };

function Body() {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(async () => {
    const { data: d, error: e } = await supabaseBrowser().from("coupons").select("*").order("created_at", { ascending: false });
    if (e) throw e;
    return (d ?? []) as Row[];
  }, []);
  const [form, setForm] = useState<CouponForm | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [camp, setCamp] = useState({ title: "", body: "" });

  async function save() {
    if (!form) return;
    try {
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(form.code)) throw new Error("Code must be 3-32 letters, digits, - or _");
      const value = form.type === "percent" ? Number(form.value) : toPaise(form.value);
      if (!value || Number.isNaN(value) || value <= 0) throw new Error("Enter a valid discount value");
      if (form.type === "percent" && value > 90) throw new Error("Percent discount cannot exceed 90");
      const max = toPaise(form.max), min = toPaise(form.min);
      if (Number.isNaN(max) || Number.isNaN(min)) throw new Error("Amounts must look like 500 or 499.50");
      const row = {
        code: form.code.toUpperCase(), type: form.type, value, max_discount_paise: max, min_order_paise: min ?? 0,
        expires_at: form.expires ? new Date(`${form.expires}T23:59:59+05:30`).toISOString() : null,
        usage_limit_total: form.total ? Number(form.total) : null, usage_limit_per_user: form.perUser ? Number(form.perUser) : null, is_active: form.active,
      };
      const db = supabaseBrowser();
      const r = form.id ? await db.from("coupons").update(row).eq("id", form.id) : await db.from("coupons").insert(row);
      if (r.error) throw r.error;
      setForm(null);
      setMsg({ kind: "ok", text: "Coupon saved. Redemption limits are enforced atomically at checkout." });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  async function send() {
    if (camp.title.trim().length < 3 || camp.body.trim().length < 3) return setMsg({ kind: "error", text: "Title and message are required." });
    if (!window.confirm("Send this to every customer who opted in to marketing notifications?")) return;
    try {
      const n = await rpc<number>("admin_send_campaign", { p_title: camp.title.trim(), p_body: camp.body.trim(), p_data: {} });
      setMsg({ kind: "ok", text: `Queued for ${n ?? 0} opted-in customers.` });
      setCamp({ title: "", body: "" });
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  return (
    <>
      <PageHeader title="Coupons & campaigns" actions={perms.has("coupons.manage") ? <Btn onClick={() => setForm(blank)}>New coupon</Btn> : null} />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      {perms.has("coupons.manage") && (loading && !data ? <Loading /> : (data ?? []).length === 0 ? <Empty>No coupons yet.</Empty> : (
        <Table head={["Code", "Discount", "Min order", "Used", "Expires", "Active", ""]}>
          {(data ?? []).map((c) => (
            <tr key={String(c.id)}>
              <Td className="font-mono font-semibold">{String(c.code)}</Td>
              <Td>{c.type === "percent" ? `${String(c.value)}%${c.max_discount_paise ? ` (max ${rupees(Number(c.max_discount_paise))})` : ""}` : rupees(Number(c.value))}</Td>
              <Td>{rupees(Number(c.min_order_paise))}</Td>
              <Td>{String(c.used_count)}{c.usage_limit_total ? ` / ${String(c.usage_limit_total)}` : ""}</Td>
              <Td>{c.expires_at ? dateTime(String(c.expires_at)) : "Never"}</Td>
              <Td>{c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}</Td>
              <Td><Btn kind="ghost" onClick={() => setForm({
                id: String(c.id), code: String(c.code), type: c.type as "flat" | "percent", value: c.type === "percent" ? String(c.value) : String(Number(c.value) / 100),
                max: c.max_discount_paise ? String(Number(c.max_discount_paise) / 100) : "", min: c.min_order_paise ? String(Number(c.min_order_paise) / 100) : "",
                expires: c.expires_at ? String(c.expires_at).slice(0, 10) : "", total: String(c.usage_limit_total ?? ""), perUser: String(c.usage_limit_per_user ?? ""), active: Boolean(c.is_active),
              })}>Edit</Btn></Td>
            </tr>
          ))}
        </Table>
      ))}

      {perms.has("marketing.send") && (
        <div className="mt-6 max-w-xl">
          <Card title="Send a marketing notification">
            <p className="mb-3 text-xs text-neutral-500">Only customers who opted in receive this. Transactional messages (order updates) are separate and always sent.</p>
            <div className="space-y-3">
              <Field label="Title"><input className={inputCls} maxLength={60} value={camp.title} onChange={(e) => setCamp({ ...camp, title: e.target.value })} /></Field>
              <Field label="Message"><textarea className={inputCls} rows={3} maxLength={200} value={camp.body} onChange={(e) => setCamp({ ...camp, body: e.target.value })} /></Field>
              <Btn onClick={send}>Send to opted-in customers</Btn>
            </div>
          </Card>
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Edit coupon" : "New coupon"} onClose={() => setForm(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code"><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Type"><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "flat" | "percent" })}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select></Field>
            <Field label={form.type === "percent" ? "Percent (1-90)" : "Amount (₹)"}><input className={inputCls} inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
            <Field label="Max discount (₹)" hint="Caps percent coupons"><input className={inputCls} inputMode="decimal" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></Field>
            <Field label="Minimum order (₹)"><input className={inputCls} inputMode="decimal" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} /></Field>
            <Field label="Expires on"><input className={inputCls} type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></Field>
            <Field label="Total uses (blank = unlimited)"><input className={inputCls} inputMode="numeric" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
            <Field label="Uses per customer"><input className={inputCls} inputMode="numeric" value={form.perUser} onChange={(e) => setForm({ ...form, perUser: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Active</label>
          </div>
          <div className="mt-4 flex gap-2"><Btn onClick={save}>Save coupon</Btn><Btn kind="ghost" onClick={() => setForm(null)}>Cancel</Btn></div>
        </Modal>
      )}
    </>
  );
}

export default function MarketingPage() {
  return <Guard perm="coupons.manage|marketing.send|notifications.send"><Body /></Guard>;
}
