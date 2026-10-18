"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Badge, Card, Empty, Loading, Notice, PageHeader, Stat, Table, Td, inputCls, statusTone } from "@/components/ui";
import { useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label, rupees } from "@/lib/format";

const STATUSES = ["draft", "available", "reserved", "sold", "inspection", "returned_repair", "unavailable", "archived"];

async function load(status: string) {
  const db = supabaseBrowser();
  let q = db.from("admin_inventory_units")
    .select("id,unit_code,status,selling_price_paise,condition_grade,reserved_until,reserved_order_id,updated_at,model_id,model_name,storage_gb,color")
    .order("updated_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const [units, adj, counts] = await Promise.all([
    q,
    db.from("inventory_adjustments").select("*").order("created_at", { ascending: false }).limit(30),
    db.from("admin_inventory_units").select("status"),
  ]);
  for (const r of [units, adj, counts]) if (r.error) throw r.error;
  const tally: Record<string, number> = {};
  for (const c of counts.data ?? []) tally[String(c.status)] = (tally[String(c.status)] ?? 0) + 1;
  return { units: (units.data ?? []) as unknown as Row[], adjustments: (adj.data ?? []) as Row[], tally };
}

function Body() {
  const [status, setStatus] = useState("");
  const { data, error, loading } = useLoad(() => load(status), [status]);
  if (error) return <Notice>{error}</Notice>;
  return (
    <>
      <PageHeader title="Inventory" subtitle="Reserved units are held for a checkout in progress and return to stock when the reservation expires. Status changes need a reason."
        actions={<select aria-label="Filter status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>} />
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["available", "reserved", "sold", "inspection"].map((s) => <Stat key={s} label={label(s)} value={data.tally[s] ?? 0} />)}
          </div>
          {data.units.length === 0 ? <Empty>No units.</Empty> : (
            <Table head={["Unit", "Model", "Variant", "Grade", "Price", "Status", "Reserved until"]}>
              {data.units.map((u) => {
                return (
                  <tr key={String(u.id)}>
                    <Td className="font-mono text-xs">{String(u.unit_code)}</Td>
                    <Td><Link className="underline" href={`/products/${String(u.model_id)}`}>{String(u.model_name)}</Link></Td>
                    <Td>{String(u.storage_gb)}GB · {String(u.color)}</Td>
                    <Td>{String(u.condition_grade)}</Td>
                    <Td>{rupees(Number(u.selling_price_paise))}</Td>
                    <Td><Badge tone={statusTone(String(u.status))}>{label(String(u.status))}</Badge></Td>
                    <Td className="text-neutral-500">{u.reserved_until ? dateTime(String(u.reserved_until)) : "-"}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
          <Card title="Recent manual adjustments">
            {data.adjustments.length === 0 ? <p className="text-sm text-neutral-500">None yet.</p> : (
              <ul className="space-y-1 text-sm">
                {data.adjustments.map((a) => (
                  <li key={String(a.id)}><span className="text-neutral-500">{dateTime(String(a.created_at))}</span> · {label(String(a.from_status))} → <b>{label(String(a.to_status))}</b> · {String(a.reason)}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default function InventoryPage() {
  return <Guard perm="inventory.read"><Body /></Guard>;
}
