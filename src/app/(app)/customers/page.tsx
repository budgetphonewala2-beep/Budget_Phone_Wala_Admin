"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Loading, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label } from "@/lib/format";

const PAGE = 25;

function Body() {
  const perms = usePerms();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const customers = useLoad(() => rpc<{ total?: number; items?: Row[] } | Row[]>("admin_list_customers", { p_search: applied || null, p_limit: PAGE, p_offset: page * PAGE }), [applied, page]);
  const requests = useLoad(async () => {
    const { data, error } = await supabaseBrowser().from("data_requests").select("*").order("requested_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as Row[];
  }, []);

  const rows: Row[] = Array.isArray(customers.data) ? customers.data : (customers.data?.items ?? []);

  async function blockCod(id: string, blocked: boolean) {
    try { await rpc("admin_set_customer_cod_block", { p_user: id, p_blocked: blocked }); setMsg({ kind: "ok", text: blocked ? "COD blocked for this customer." : "COD allowed again." }); await customers.reload(); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }
  async function processRequest(id: string, action: string) {
    const note = window.prompt(`Note for this ${action} (kept with the request):`) ?? "";
    try { await rpc("admin_process_data_request", { p_id: id, p_action: action, p_note: note }); setMsg({ kind: "ok", text: `Request ${action}.` }); await requests.reload(); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="Contact details are shown only to staff with customer access. Deletion and export requests are handled below." />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {customers.error && <Notice>{customers.error}</Notice>}
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(q); }}>
        <input aria-label="Search customers" className={`${inputCls} max-w-xs`} placeholder="Name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Btn type="submit">Search</Btn>
      </form>
      {customers.loading && !customers.data && <Loading />}
      {rows.length === 0 && !customers.loading ? <Empty>No customers found.</Empty> : (
        <Table head={["Name", "Phone", "Email", "Orders", "Delivery issues", "COD", "Joined", ""]}>
          {rows.map((c) => (
            <tr key={String(c.id)}>
              <Td>{String(c.full_name ?? "-")}</Td><Td>{String(c.phone ?? "-")}</Td><Td>{String(c.email ?? "-")}</Td>
              <Td>{String(c.orders_count ?? "-")}</Td>
              <Td>{c.deleted_at ? "Deleted" : String(c.failed_delivery_count ?? 0) + " failed deliveries"}</Td>
              <Td>{c.cod_blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Allowed</Badge>}</Td>
              <Td>{c.created_at ? dateTime(String(c.created_at)) : "-"}</Td>
              <Td>{perms.has("delivery.configure") && <Btn kind="ghost" onClick={() => blockCod(String(c.id), !c.cod_blocked)}>{c.cod_blocked ? "Allow COD" : "Block COD"}</Btn>}</Td>
            </tr>
          ))}
        </Table>
      )}
      <div className="mt-3 flex gap-2">
        <Btn kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn>
        <Btn kind="ghost" disabled={rows.length < PAGE} onClick={() => setPage(page + 1)}>Next</Btn>
      </div>

      <div className="mt-8">
        <Card title="Data export & deletion requests">
          {requests.error && <Notice>{requests.error}</Notice>}
          {(requests.data ?? []).length === 0 ? <p className="text-sm text-neutral-500">No requests.</p> : (
            <Table head={["Type", "Status", "Requested", "Notes", ""]}>
              {(requests.data ?? []).map((r) => (
                <tr key={String(r.id)}>
                  <Td>{label(String(r.type))}</Td>
                  <Td><Badge tone={statusTone(String(r.status))}>{label(String(r.status))}</Badge></Td>
                  <Td>{dateTime(String(r.requested_at))}</Td><Td>{String(r.notes ?? "")}</Td>
                  <Td>{(r.status === "requested" || r.status === "processing") && perms.has("customers.requests.manage") && (
                    <div className="flex gap-1.5">
                      <Btn kind="ghost" onClick={() => processRequest(String(r.id), "complete")}>Complete</Btn>
                      <Btn kind="danger" onClick={() => processRequest(String(r.id), "reject")}>Reject</Btn>
                    </div>)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

export default function CustomersPage() {
  return <Guard perm="customers.read"><Body /></Guard>;
}
