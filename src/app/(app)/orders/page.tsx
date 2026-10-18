"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Badge, Btn, Empty, Loading, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { rpc, useLoad } from "@/lib/data";
import { dateTime, label, rupees } from "@/lib/format";

type OrderRow = {
  id: string; order_number: string; status: string; payment_method: string; payment_status: string; fulfillment_type: string;
  total_paise: number; customer_name: string; customer_phone: string; created_at: string;
};
type Result = { total: number; items: OrderRow[] };

const STATUSES = ["pending_payment", "placed", "confirmed", "packed", "dispatched", "out_for_delivery", "ready_for_pickup", "delivered", "picked_up", "delivery_failed", "cancelled", "returned"];
const PAGE = 25;

function Body() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState({ q: "", status: "", method: "" });
  const { data, error, loading } = useLoad(
    () => rpc<Result>("admin_search_orders", {
      p_query: applied.q || null, p_status: applied.status || null, p_payment_method: applied.method || null,
      p_limit: PAGE, p_offset: page * PAGE,
    }),
    [applied, page],
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <PageHeader title="Orders" subtitle="Search by order number, customer name or phone." />
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied({ q, status, method }); }}>
        <input className={`${inputCls} max-w-xs`} placeholder="Order no., name or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        <select className={`${inputCls} max-w-[12rem]`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select className={`${inputCls} max-w-[10rem]`} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
          <option value="">All payments</option>
          <option value="razorpay">Online (Razorpay)</option>
          <option value="cod">Cash on delivery</option>
        </select>
        <Btn type="submit">Search</Btn>
      </form>
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}
      {data && (data.items.length === 0 ? <Empty>No orders match.</Empty> : (
        <Table head={["Order", "Customer", "Status", "Payment", "Type", "Total", "Placed"]}>
          {data.items.map((o) => (
            <tr key={o.id} className="hover:bg-neutral-50">
              <Td><Link className="font-semibold text-[#D7263D] underline" href={`/orders/${o.id}`}>{o.order_number}</Link></Td>
              <Td>{o.customer_name}<div className="text-xs text-neutral-500">{o.customer_phone}</div></Td>
              <Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td>
              <Td>{label(o.payment_method)}<div><Badge tone={statusTone(o.payment_status)}>{label(o.payment_status)}</Badge></div></Td>
              <Td>{label(o.fulfillment_type)}</Td>
              <Td className="font-semibold">{rupees(o.total_paise)}</Td>
              <Td className="text-neutral-500">{dateTime(o.created_at)}</Td>
            </tr>
          ))}
        </Table>
      ))}
      {data && data.total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">{data.total} orders · page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <Btn kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn>
            <Btn kind="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Btn>
          </div>
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  return <Guard perm="orders.read"><Body /></Guard>;
}
