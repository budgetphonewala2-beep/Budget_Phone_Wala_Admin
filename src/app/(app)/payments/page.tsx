"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Loading, Notice, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label, rupees } from "@/lib/format";

async function load() {
  const db = supabaseBrowser();
  const [pays, refunds, cod] = await Promise.all([
    db.from("payment_attempts").select("*, orders!inner(order_number)").order("created_at", { ascending: false }).limit(100),
    db.from("refunds").select("*, orders!inner(order_number)").order("created_at", { ascending: false }).limit(100),
    db.from("cod_collections").select("*, orders!inner(order_number)").in("status", ["pending", "collected"]).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const r of [pays, refunds, cod]) if (r.error) throw r.error;
  return { pays: (pays.data ?? []) as unknown as Row[], refunds: (refunds.data ?? []) as unknown as Row[], cod: (cod.data ?? []) as unknown as Row[] };
}

function Body() {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function reconcile(orderId: string) {
    try { await rpc("reconcile_cod", { p_order: orderId, p_notes: "" }); setMsg({ kind: "ok", text: "COD reconciled." }); await reload(); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }
  const num = (r: Row) => String((r.orders as Row).order_number);

  if (error) return <Notice>{error}</Notice>;
  return (
    <>
      <PageHeader title="Payments, COD & refunds" subtitle="Online payments are confirmed only by Razorpay's verified response. Refunds are executed through Razorpay, never by editing a status." />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-5">
          <Card title="COD awaiting reconciliation">
            {data.cod.length === 0 ? <Empty>Nothing pending.</Empty> : (
              <Table head={["Order", "Amount", "Status", "Collected", ""]}>
                {data.cod.map((c) => (
                  <tr key={String(c.id)}>
                    <Td><Link className="underline" href={`/orders/${String(c.order_id)}`}>{num(c)}</Link></Td>
                    <Td>{rupees(Number(c.amount_paise))}</Td>
                    <Td><Badge tone={statusTone(String(c.status))}>{label(String(c.status))}</Badge></Td>
                    <Td>{c.collected_at ? dateTime(String(c.collected_at)) : "-"}</Td>
                    <Td>{c.status === "collected" && perms.has("payments.reconcile") && <Btn kind="ghost" onClick={() => reconcile(String(c.order_id))}>Reconcile</Btn>}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Refunds">
            {data.refunds.length === 0 ? <Empty>No refunds.</Empty> : (
              <Table head={["Order", "Amount", "Status", "Reason", "Provider ref", "When"]}>
                {data.refunds.map((r) => (
                  <tr key={String(r.id)}>
                    <Td><Link className="underline" href={`/orders/${String(r.order_id)}`}>{num(r)}</Link></Td>
                    <Td>{rupees(Number(r.amount_paise))}</Td>
                    <Td><Badge tone={statusTone(String(r.status))}>{label(String(r.status))}</Badge>{r.failure_reason ? <div className="text-xs text-red-700">{String(r.failure_reason)}</div> : null}</Td>
                    <Td>{String(r.reason)}</Td>
                    <Td className="font-mono text-xs">{String(r.provider_refund_id ?? "-")}</Td>
                    <Td>{dateTime(String(r.created_at))}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Online payment attempts (latest 100)">
            {data.pays.length === 0 ? <Empty>No attempts.</Empty> : (
              <Table head={["Order", "Amount", "Status", "Method", "Signature verified", "Payment id", "When"]}>
                {data.pays.map((p) => (
                  <tr key={String(p.id)}>
                    <Td><Link className="underline" href={`/orders/${String(p.order_id)}`}>{num(p)}</Link></Td>
                    <Td>{rupees(Number(p.amount_paise))}</Td>
                    <Td><Badge tone={statusTone(String(p.status))}>{label(String(p.status))}</Badge></Td>
                    <Td>{String(p.method ?? "-")}</Td>
                    <Td>{p.signature_verified ? "Yes" : "No"}</Td>
                    <Td className="font-mono text-xs">{String(p.provider_payment_id ?? "-")}</Td>
                    <Td>{dateTime(String(p.created_at))}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default function PaymentsPage() {
  return <Guard perm="payments.read"><Body /></Guard>;
}
