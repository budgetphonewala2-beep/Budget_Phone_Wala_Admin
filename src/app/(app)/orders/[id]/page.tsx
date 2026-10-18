"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Field, Loading, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label, rupees, toPaise } from "@/lib/format";

type Order = Row & {
  id: string; order_number: string; status: string; payment_method: string; payment_status: string; fulfillment_type: string;
  subtotal_paise: number; discount_paise: number; delivery_fee_paise: number; cod_fee_paise: number; tax_paise: number; total_paise: number;
  customer_name: string; customer_phone: string; customer_email: string | null; address_snapshot: Record<string, string> | null;
  pickup_snapshot: Record<string, string> | null; cancel_reason: string | null; created_at: string; expires_at: string | null;
};

async function loadOrder(id: string) {
  const db = supabaseBrowser();
  const [o, items, hist, ful, pays, refs, cod, trans] = await Promise.all([
    db.from("orders").select("*").eq("id", id).single(),
    db.from("order_items").select("*").eq("order_id", id),
    db.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    db.from("order_fulfillments").select("*").eq("order_id", id).maybeSingle(),
    db.from("payment_attempts").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("refunds").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("cod_collections").select("*").eq("order_id", id).maybeSingle(),
    db.from("order_status_transitions").select("*"),
  ]);
  for (const r of [o, items, hist, ful, pays, refs, cod, trans]) if (r.error) throw r.error;
  return {
    order: o.data as Order, items: (items.data ?? []) as Row[], history: (hist.data ?? []) as Row[], fulfillment: ful.data as Row | null,
    payments: (pays.data ?? []) as Row[], refunds: (refs.data ?? []) as Row[], cod: cod.data as Row | null, transitions: (trans.data ?? []) as Row[],
  };
}

function Body({ id }: { id: string }) {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(() => loadOrder(id), [id]);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [codAmt, setCodAmt] = useState("");
  const [codRef, setCodRef] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Notice>{error}</Notice>;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const { order: o, items, history, fulfillment, payments, refunds, cod, transitions } = data;
  const next = transitions.filter((t) => t.from_status === o.status && (!t.fulfillment_type || t.fulfillment_type === o.fulfillment_type) && perms.has(String(t.required_permission)));
  const addr = o.address_snapshot ?? {};
  const pickup = o.pickup_snapshot ?? {};

  return (
    <>
      <PageHeader title={`Order ${o.order_number}`} subtitle={`Placed ${dateTime(o.created_at)}`}
        actions={<Link href="/orders"><Btn kind="ghost">Back to orders</Btn></Link>} />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Summary" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone={statusTone(o.status)}>{label(o.status)}</Badge>
            <Badge tone={statusTone(o.payment_status)}>{label(o.payment_status)}</Badge>
            <Badge>{label(o.payment_method)}</Badge>
            <Badge>{label(o.fulfillment_type)}</Badge>
          </div>
          <Table head={["Item", "Grade", "Battery", "IMEI", "Price"]}>
            {items.map((i) => (
              <tr key={String(i.id)}>
                <Td>{String(i.title)}</Td><Td>{String(i.condition_grade ?? "-")}</Td>
                <Td>{i.battery_health_pct ? `${i.battery_health_pct}%` : "-"}</Td>
                <Td>{i.imei_last4 ? `••••${String(i.imei_last4)}` : "-"}</Td>
                <Td>{rupees(Number(i.price_paise))}</Td>
              </tr>
            ))}
          </Table>
          <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
            {[["Subtotal", o.subtotal_paise], ["Discount", -o.discount_paise], ["Delivery", o.delivery_fee_paise], ["COD fee", o.cod_fee_paise], ["Tax", o.tax_paise]].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between"><dt className="text-neutral-500">{k}</dt><dd>{rupees(Number(v))}</dd></div>
            ))}
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-bold"><dt>Total</dt><dd>{rupees(o.total_paise)}</dd></div>
          </dl>
        </Card>

        <Card title="Customer & delivery">
          <div className="text-sm">
            <div className="font-semibold">{o.customer_name}</div>
            <div>{o.customer_phone}</div>
            {o.customer_email && <div className="text-neutral-500">{o.customer_email}</div>}
            <div className="mt-3 font-semibold">{o.fulfillment_type === "pickup" ? "Pickup" : "Ship to"}</div>
            {o.fulfillment_type === "pickup" ? (
              <div className="text-neutral-600">{Object.values(pickup).join(", ") || "Store pickup"}</div>
            ) : (
              <div className="text-neutral-600">{[addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</div>
            )}
            {fulfillment && (
              <div className="mt-3 text-neutral-600">
                {fulfillment.courier_name ? <div>Courier: {String(fulfillment.courier_name)} {fulfillment.tracking_reference ? `· ${String(fulfillment.tracking_reference)}` : ""}</div> : null}
                {fulfillment.dispatched_at ? <div>Dispatched: {dateTime(String(fulfillment.dispatched_at))}</div> : null}
                {fulfillment.delivered_at ? <div>Delivered: {dateTime(String(fulfillment.delivered_at))}</div> : null}
                {fulfillment.pickup_ready_at ? <div>Ready for pickup: {dateTime(String(fulfillment.pickup_ready_at))}</div> : null}
                {fulfillment.picked_up_at ? <div>Collected: {dateTime(String(fulfillment.picked_up_at))}</div> : null}
              </div>
            )}
            {o.cancel_reason && <div className="mt-3 text-red-700">Cancelled: {o.cancel_reason}</div>}
          </div>
        </Card>

        {next.length > 0 && (
          <Card title="Update status" className="lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Note (kept in history)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              {next.some((t) => t.to_status === "dispatched") && (<>
                <Field label="Courier name (required to dispatch)"><input className={inputCls} value={courier} onChange={(e) => setCourier(e.target.value)} /></Field>
                <Field label="Tracking reference"><input className={inputCls} value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
              </>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {next.map((t) => {
                const to = String(t.to_status);
                const cancel = to === "cancelled";
                return (
                  <Btn key={to} kind={cancel ? "danger" : "primary"} disabled={busy}
                    onClick={() => act(() => rpc("admin_transition_order", {
                      p_order: o.id, p_to: to, p_note: note,
                      p_data: to === "dispatched" ? { courier_name: courier, tracking_reference: tracking } : {},
                    }), `Order moved to ${label(to)}.`)}>
                    {cancel ? "Cancel order" : `Mark ${label(to).toLowerCase()}`}
                  </Btn>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-neutral-500">Online orders are marked paid only by verified payment confirmation, never by this screen.</p>
          </Card>
        )}

        {o.payment_method === "cod" && cod && perms.has("cod.collect") && cod.status === "pending" && o.status !== "cancelled" && (
          <Card title="Record COD collection" className="lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Amount collected (₹)" hint={`Order total ${rupees(o.total_paise)}`}><input className={inputCls} inputMode="decimal" value={codAmt} onChange={(e) => setCodAmt(e.target.value)} /></Field>
              <Field label="Reference / receipt no."><input className={inputCls} value={codRef} onChange={(e) => setCodRef(e.target.value)} /></Field>
              <div className="flex items-end">
                <Btn disabled={busy} onClick={() => {
                  const p = toPaise(codAmt);
                  if (p == null || Number.isNaN(p) || p <= 0) return setMsg({ kind: "error", text: "Enter a valid amount." });
                  void act(() => rpc("record_cod_collection", { p_order: o.id, p_amount_paise: p, p_reference: codRef || null }), "COD collection recorded.");
                }}>Record collection</Btn>
              </div>
            </div>
          </Card>
        )}

        {cod && cod.status === "collected" && perms.has("payments.reconcile") && (
          <Card title="Reconcile COD" className="lg:col-span-3">
            <p className="mb-2 text-sm">Collected {rupees(Number(cod.amount_paise))} on {dateTime(String(cod.collected_at))}. Reconcile once the cash is in the shop account.</p>
            <Btn disabled={busy} onClick={() => act(() => rpc("reconcile_cod", { p_order: o.id, p_notes: "" }), "COD reconciled.")}>Mark reconciled</Btn>
          </Card>
        )}

        <Card title="Payments" className="lg:col-span-2">
          {payments.length === 0 ? <p className="text-sm text-neutral-500">No payment attempts.</p> : (
            <Table head={["When", "Provider", "Amount", "Status", "Payment id"]}>
              {payments.map((p) => (
                <tr key={String(p.id)}>
                  <Td>{dateTime(String(p.created_at))}</Td><Td>{String(p.provider)}</Td><Td>{rupees(Number(p.amount_paise))}</Td>
                  <Td><Badge tone={statusTone(String(p.status))}>{label(String(p.status))}</Badge></Td>
                  <Td className="font-mono text-xs">{String(p.provider_payment_id ?? "-")}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Refunds">
          {refunds.length === 0 ? <p className="text-sm text-neutral-500">No refunds.</p> : refunds.map((r) => (
            <div key={String(r.id)} className="mb-2 text-sm">
              {rupees(Number(r.amount_paise))} <Badge tone={statusTone(String(r.status))}>{label(String(r.status))}</Badge>
              <div className="text-xs text-neutral-500">{String(r.reason)}{r.failure_reason ? ` · ${String(r.failure_reason)}` : ""}</div>
            </div>
          ))}
          {perms.has("refunds.issue") && ["captured", "cod_collected", "partially_refunded"].includes(o.payment_status) && (
            <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
              <Field label="Refund amount (₹)"><input className={inputCls} inputMode="decimal" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} /></Field>
              <Field label="Reason (required)"><input className={inputCls} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} /></Field>
              <Btn kind="danger" disabled={busy} onClick={() => {
                const p = toPaise(refundAmt);
                if (p == null || Number.isNaN(p) || p <= 0) return setMsg({ kind: "error", text: "Enter a valid refund amount." });
                if (refundReason.trim().length < 3) return setMsg({ kind: "error", text: "A reason is required." });
                if (!window.confirm(`Refund ${rupees(p)} on ${o.order_number}? This cannot be undone.`)) return;
                void act(() => rpc("admin_request_refund", {
                  p_order: o.id, p_amount_paise: p, p_reason: refundReason.trim(), p_idempotency_key: crypto.randomUUID(),
                }), "Refund requested. It is sent to Razorpay by the refund worker and shown here when processed.");
              }}>Request refund</Btn>
            </div>
          )}
        </Card>

        <Card title="Status history" className="lg:col-span-3">
          <ol className="space-y-1.5 text-sm">
            {history.map((h) => (
              <li key={String(h.id)} className="flex flex-wrap gap-2">
                <span className="w-44 text-neutral-500">{dateTime(String(h.created_at))}</span>
                <Badge tone={statusTone(String(h.to_status))}>{label(String(h.to_status))}</Badge>
                <span className="text-neutral-500">{String(h.actor_type ?? "")} {h.note ? `· ${String(h.note)}` : ""}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Guard perm="orders.read"><Body id={id} /></Guard>;
}
