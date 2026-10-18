"use client";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Badge, Btn, Empty, Loading, Notice, PageHeader, Stat, Table, Td, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime } from "@/lib/format";

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
