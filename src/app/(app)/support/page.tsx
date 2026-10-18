"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label, rupees, toPaise } from "@/lib/format";

type Tab = "warranty" | "returns" | "enquiries";
const WARRANTY = ["inspecting", "approved", "rejected", "resolved"];
const RETURNS = ["approved", "rejected", "received", "closed"];
const ENQUIRY = ["reviewing", "offer_made", "accepted", "rejected", "completed", "cancelled"];

async function load() {
  const db = supabaseBrowser();
  const [w, r, e] = await Promise.all([
    db.from("warranty_claims").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("return_requests").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("sell_enquiries").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return { w: (w.data ?? []) as Row[], r: (r.data ?? []) as Row[], e: (e.data ?? []) as Row[], errs: [w.error, r.error, e.error].filter(Boolean) };
}

function Body() {
  const perms = usePerms();
  const [tab, setTab] = useState<Tab>(perms.has("warranty.manage") ? "warranty" : perms.has("returns.manage") ? "returns" : "enquiries");
  const { data, error, loading, reload } = useLoad(load, []);
  const [edit, setEdit] = useState<{ kind: Tab; row: Row } | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [resolution, setResolution] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  function open(kind: Tab, row: Row) {
    setEdit({ kind, row });
    setStatus(String(row.status));
    setNotes(String(row.admin_notes ?? ""));
    setAmount("");
    setResolution(String(row.resolution ?? ""));
  }

  async function save() {
    if (!edit) return;
    try {
      const id = edit.row.id;
      if (edit.kind === "warranty") await rpc("admin_update_warranty_claim", { p_id: id, p_status: status, p_notes: notes || null, p_resolution: resolution || null });
      else if (edit.kind === "returns") {
        const p = toPaise(amount);
        if (Number.isNaN(p)) throw new Error("Refund amount is not valid");
        await rpc("admin_update_return_request", { p_id: id, p_status: status, p_notes: notes || null, p_refund_paise: p });
      } else {
        const p = toPaise(amount);
        if (Number.isNaN(p)) throw new Error("Offer amount is not valid");
        await rpc("admin_update_enquiry", { p_id: id, p_status: status, p_offer_paise: p, p_notes: notes || null });
      }
      setEdit(null);
      setMsg({ kind: "ok", text: "Saved. The customer is notified of the new status." });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  const tabs: [Tab, string, string][] = [["warranty", "Warranty claims", "warranty.manage"], ["returns", "Returns", "returns.manage"], ["enquiries", "Sell / exchange", "enquiries.manage"]];
  const options = edit?.kind === "warranty" ? WARRANTY : edit?.kind === "returns" ? RETURNS : ENQUIRY;

  return (
    <>
      <PageHeader title="Warranty, returns & enquiries" subtitle="Returns are refunded only after the owner-approved policy applies and staff approve the request." />
      {(error || data?.errs.length) ? <Notice>{error ?? "Some lists could not be loaded with your permissions."}</Notice> : null}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="mb-3 flex gap-2" role="tablist">
        {tabs.filter(([, , p]) => perms.has(p)).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${tab === k ? "bg-[#D7263D] text-white" : "border border-neutral-300 bg-white"}`}>{l}</button>
        ))}
      </div>
      {loading && !data && <Loading />}
      {data && tab === "warranty" && (data.w.length === 0 ? <Empty>No warranty claims.</Empty> : (
        <Table head={["Claim", "Issue", "Status", "Filed", ""]}>
          {data.w.map((c) => (
            <tr key={String(c.id)}><Td className="font-mono text-xs">{String(c.claim_number)}</Td><Td>{String(c.issue)}</Td>
              <Td><Badge tone={statusTone(String(c.status))}>{label(String(c.status))}</Badge></Td><Td>{dateTime(String(c.created_at))}</Td>
              <Td><Btn kind="ghost" onClick={() => open("warranty", c)}>Review</Btn></Td></tr>
          ))}
        </Table>
      ))}
      {data && tab === "returns" && (data.r.length === 0 ? <Empty>No return requests.</Empty> : (
        <Table head={["Request", "Reason", "Status", "Filed", ""]}>
          {data.r.map((c) => (
            <tr key={String(c.id)}><Td className="font-mono text-xs">{String(c.request_number)}</Td><Td>{String(c.reason)}</Td>
              <Td><Badge tone={statusTone(String(c.status))}>{label(String(c.status))}</Badge></Td><Td>{dateTime(String(c.created_at))}</Td>
              <Td><Btn kind="ghost" onClick={() => open("returns", c)}>Review</Btn></Td></tr>
          ))}
        </Table>
      ))}
      {data && tab === "enquiries" && (data.e.length === 0 ? <Empty>No enquiries.</Empty> : (
        <Table head={["Enquiry", "Type", "Phone", "Customer expects", "Our offer", "Status", ""]}>
          {data.e.map((c) => (
            <tr key={String(c.id)}><Td className="font-mono text-xs">{String(c.enquiry_number)}</Td>
              <Td>{label(String(c.type))}<div className="text-xs text-neutral-500">{String(c.brand)} {String(c.model)} {c.storage_gb ? `${String(c.storage_gb)}GB` : ""}</div></Td>
              <Td>{String(c.contact_name)}<div className="text-xs text-neutral-500">{String(c.contact_phone)}</div></Td>
              <Td>{rupees(c.expected_price_paise as number | null)}</Td><Td>{rupees(c.admin_offer_paise as number | null)}</Td>
              <Td><Badge tone={statusTone(String(c.status))}>{label(String(c.status))}</Badge></Td>
              <Td><Btn kind="ghost" onClick={() => open("enquiries", c)}>Respond</Btn></Td></tr>
          ))}
        </Table>
      ))}
      {edit && (
        <Modal title="Update" onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <Field label="Status"><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value={String(edit.row.status)}>{label(String(edit.row.status))} (current)</option>
              {options.filter((s) => s !== edit.row.status).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
            {edit.kind === "returns" && <Field label="Refund amount (₹)" hint="Leave blank to decide later. Money moves from the Orders screen."><input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
            {edit.kind === "enquiries" && <Field label="Offer (₹)"><input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
            {edit.kind === "warranty" && <Field label="Resolution"><input className={inputCls} value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>}
            <Field label="Notes"><textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex gap-2"><Btn onClick={save}>Save</Btn><Btn kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function SupportPage() {
  return <Guard perm="returns.manage|warranty.manage|enquiries.manage"><Body /></Guard>;
}
