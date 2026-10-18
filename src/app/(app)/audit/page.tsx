"use client";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Empty, Loading, Notice, PageHeader, Table, Td, inputCls } from "@/components/ui";
import { useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime } from "@/lib/format";

const PAGE = 50;

function Body() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, loading } = useLoad(async () => {
    let q = supabaseBrowser().from("audit_logs").select("*").order("id", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (action.trim()) q = q.ilike("action", `%${action.trim()}%`);
    const { data: d, error: e } = await q;
    if (e) throw e;
    return (d ?? []) as Row[];
  }, [action, page]);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only record of sensitive actions: price changes, refunds, exports, staff changes and status overrides." />
      <input aria-label="Filter by action" className={`${inputCls} mb-3 max-w-xs`} placeholder="Filter, e.g. REFUND or UNIT" value={action} onChange={(e) => { setPage(0); setAction(e.target.value); }} />
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}
      {data && (data.length === 0 ? <Empty>No entries.</Empty> : (
        <Table head={["When", "Action", "Entity", "Actor", "Details"]}>
          {data.map((a) => (
            <tr key={String(a.id)}>
              <Td className="whitespace-nowrap">{dateTime(String(a.created_at))}</Td>
              <Td className="font-mono text-xs">{String(a.action)}</Td>
              <Td className="text-xs">{String(a.entity_type)} {String(a.entity_id ?? "")}</Td>
              <Td className="font-mono text-xs">{a.actor_id ? String(a.actor_id).slice(0, 8) : "system"}</Td>
              <Td className="max-w-md break-words font-mono text-xs text-neutral-600">{JSON.stringify(a.after_data ?? a.meta ?? {})}</Td>
            </tr>
          ))}
        </Table>
      ))}
      <div className="mt-3 flex gap-2 text-sm">
        <button className="rounded-xl border border-neutral-300 px-3 py-1.5 disabled:opacity-50" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
        <button className="rounded-xl border border-neutral-300 px-3 py-1.5 disabled:opacity-50" disabled={(data?.length ?? 0) < PAGE} onClick={() => setPage(page + 1)}>Older</button>
      </div>
    </>
  );
}

export default function AuditPage() {
  return <Guard perm="audit.view"><Body /></Guard>;
}
