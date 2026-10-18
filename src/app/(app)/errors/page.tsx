"use client";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Badge, Btn, Card, Empty, Loading, Notice, PageHeader, Stat, Table, Td, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime } from "@/lib/format";

const CHECKS: { key: string; label: string; hint: string; critical: boolean }[] = [
  { key: "money_taken_order_not_confirmed", label: "Paid but order not confirmed", hint: "A customer was charged and the order is not confirmed. Confirm it or refund.", critical: true },
  { key: "expired_orders_not_released", label: "Unpaid orders not cancelled", hint: "The hold-release job is not running.", critical: true },
  { key: "expired_reservations_not_released", label: "Phones stuck on hold", hint: "Phones are hidden from the shop. The hold-release job is not running.", critical: true },
  { key: "payment_event_problems_24h", label: "Payment events that did not match", hint: "Last 24 hours. Check Payments.", critical: true },
  { key: "refunds_stuck_over_1h", label: "Refunds waiting over 1 hour", hint: "Check the refund status in Payments.", critical: true },
  { key: "notifications_stuck_over_15m", label: "Notifications not sent", hint: "The dispatcher is not running.", critical: false },
  { key: "notification_failures_1h", label: "Notification failures (1 hour)", hint: "", critical: false },
  { key: "app_crashes_1h", label: "App crashes (1 hour)", hint: "", critical: false },
];

function Operations() {
  const { data, error, loading } = useLoad(() => rpc<Record<string, number>>("admin_ops_health"), []);
  if (error) return <Notice>{error}</Notice>;
  if (loading && !data) return null;
  const rows = CHECKS.map((c) => ({ ...c, n: Number(data?.[c.key] ?? 0) }));
  const bad = rows.filter((r) => r.critical && r.n > 0);
  return (
    <Card title="Operations">
      <div className={`mb-3 rounded-xl px-3 py-2 text-sm font-semibold ${bad.length ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
        {bad.length ? `${bad.length} item${bad.length > 1 ? "s" : ""} need attention` : "Everything is running normally"}
      </div>
      <ul className="divide-y divide-neutral-100 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-3 py-2">
            <div>
              <div className="font-medium">{r.label}</div>
              {r.n > 0 && r.hint && <div className="text-xs text-neutral-500">{r.hint}</div>}
            </div>
            <Badge tone={r.n === 0 ? "green" : r.critical ? "red" : "amber"}>{r.n}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Body() {
  const [category, setCategory] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    let q = supabaseBrowser().from("client_error_reports").select("*").order("id", { ascending: false }).limit(200);
    if (category) q = q.eq("category", category);
    const { data: d, error: e } = await q;
    if (e) throw e;
    return (d ?? []) as Row[];
  }, [category]);

  const [openedAt] = useState(() => Date.now());
  const day = openedAt - 864e5;
  const last24 = (data ?? []).filter((r) => new Date(String(r.created_at)).getTime() > day);
  const fatal24 = last24.filter((r) => r.fatal).length;

  async function purge() {
    if (!window.confirm("Delete error reports older than 90 days?")) return;
    try { const n = await rpc<number>("purge_client_errors", { p_days: 90 }); setMsg({ kind: "ok", text: `${n} old reports deleted.` }); await reload(); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  return (
    <>
      <PageHeader title="App health" subtitle="Errors reported by the customer apps. Emails, tokens and long numbers are removed before storage; reports are kept 90 days."
        actions={<>
          <select aria-label="Category" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {["payment", "checkout", "flutter", "unhandled"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Btn kind="ghost" onClick={purge}>Delete old reports</Btn>
        </>} />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      <div className="mb-4"><Operations /></div>
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Reports (24h)" value={last24.length} />
            <Stat label="Crashes (24h)" value={fatal24} hint="Fatal unhandled errors" />
            <Stat label="Payment errors (24h)" value={last24.filter((r) => r.category === "payment").length} hint="Failures other than the customer cancelling" />
          </div>
          {data.length === 0 ? <Empty>No errors reported. That is good news.</Empty> : (
            <Table head={["When", "Version", "Category", "Where", "Message"]}>
              {data.map((r) => (
                <tr key={String(r.id)}>
                  <Td className="whitespace-nowrap">{dateTime(String(r.created_at))}</Td>
                  <Td className="whitespace-nowrap">{String(r.app_version)} ({String(r.build_number ?? "-")}) · {String(r.platform)}</Td>
                  <Td>{r.fatal ? <Badge tone="red">crash</Badge> : <Badge tone="amber">{String(r.category)}</Badge>}</Td>
                  <Td className="text-xs">{String(r.operation)}</Td>
                  <Td className="max-w-md break-words font-mono text-xs text-neutral-700">{String(r.message)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </>
  );
}

export default function ErrorsPage() {
  return <Guard perm="audit.view"><Body /></Guard>;
}
