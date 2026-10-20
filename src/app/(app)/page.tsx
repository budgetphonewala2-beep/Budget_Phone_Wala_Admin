"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card, Empty, Loading, Notice, PageHeader, Stat, inputCls } from "@/components/ui";
import { rpc, useLoad } from "@/lib/data";
import { rupees } from "@/lib/format";
import { usePerms } from "@/components/shell";

type Dash = {
  orders: { total: number; completed: number; cancelled: number; pending: number; paid: number; by_status: Record<string, number> };
  sales: null | { gmv_paise: number; gross_sales_paise: number; discounts_paise: number; refunds_paise: number; net_sales_paise: number;
    average_order_value_paise: number | null; collected_online_paise: number; cod_reconciled_paise: number; cod_pending_paise: number };
  inventory: { units_in_stock: number; stock_value_at_price_paise: number; reserved_units: number; low_stock_models: number;
    stock_value_at_cost_paise: number | null; units_with_cost_recorded: number | null };
  profit: null | { unit_gross_profit_paise: number; items_with_cost: number; items_total: number; note: string };
  top_models: { model: string; units: number; revenue_paise: number }[];
  top_brands: { brand: string; units: number; revenue_paise: number }[];
};
type Point = { day: string; orders: number; net_paise: number };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

type Todo = { label: string; count: number; href: string; hint: string };

/** Counts of work waiting for a person. A count the signed-in role cannot read simply does not appear. */
async function loadTodos(): Promise<Todo[]> {
  const db = supabaseBrowser();
  const count = async (table: string, col: string, values: string[]) => {
    const { count: c, error } = await db.from(table).select("id", { count: "exact", head: true }).in(col, values);
    return error ? null : (c ?? 0);
  };
  const codCount = async () => {
    const { count: c, error } = await db.from("cod_collections").select("order_id", { count: "exact", head: true }).eq("status", "collected");
    return error ? null : (c ?? 0);
  };
  const [orders, cod, returns, warranty, enquiries, refunds] = await Promise.all([
    count("orders", "status", ["placed", "confirmed", "packed"]),
    codCount(),
    count("return_requests", "status", ["requested"]),
    count("warranty_claims", "status", ["submitted"]),
    count("sell_enquiries", "status", ["submitted"]),
    count("refunds", "status", ["requested", "pending"]),
  ]);
  const all: [string, number | null, string, string][] = [
    ["Orders to process", orders, "/orders", "Placed, confirmed or packed"],
    ["COD to reconcile", cod, "/payments", "Cash collected, not yet reconciled"],
    ["Return requests", returns, "/support", "Waiting for a decision"],
    ["Warranty claims", warranty, "/support", "New claims"],
    ["Sell / exchange enquiries", enquiries, "/support", "Waiting for an offer"],
    ["Refunds in progress", refunds, "/payments", "Requested or pending"],
  ];
  return all.filter(([, c]) => c != null).map(([label, c, href, hint]) => ({ label, count: c as number, href, hint }));
}

function range(from: string, to: string) {
  // IST day boundaries expressed as absolute timestamps; `to` is inclusive of the chosen day
  const f = new Date(`${from}T00:00:00+05:30`);
  const t = new Date(`${to}T00:00:00+05:30`);
  t.setDate(t.getDate() + 1);
  return { p_from: f.toISOString(), p_to: t.toISOString() };
}

type Step = { done: boolean; text: string; href: string; action: string };

/** First-run checklist: the shop is not ready for customers until these exist. Disappears when everything is done. */
function SetupChecklist() {
  const { data } = useLoad(async (): Promise<Step[]> => {
    const db = supabaseBrowser();
    const n = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? null : (r.count ?? 0); };
    const [live, zones, ret, war] = await Promise.all([
      n(db.from("admin_inventory_units").select("id", { count: "exact", head: true }).eq("status", "available")),
      n(db.from("delivery_zones").select("id", { count: "exact", head: true }).eq("is_active", true)),
      n(db.from("return_policies").select("id", { count: "exact", head: true }).eq("is_active", true).not("approved_at", "is", null)),
      n(db.from("warranty_policies").select("id", { count: "exact", head: true }).eq("is_active", true).not("approved_at", "is", null)),
    ]);
    const steps: Step[] = [];
    if (live != null) steps.push({ done: live > 0, text: "Add your first phone so customers can see it in the app", href: "/products/new", action: "Add a phone" });
    if (zones != null) steps.push({ done: zones > 0, text: "Add a delivery zone (areas, charges, cash on delivery)", href: "/delivery", action: "Set up delivery" });
    if (ret != null) steps.push({ done: ret > 0, text: "Approve your return policy (customers cannot request returns without it)", href: "/settings", action: "Open policies" });
    if (war != null) steps.push({ done: war > 0, text: "Approve your warranty policy", href: "/settings", action: "Open policies" });
    return steps;
  }, []);
  if (!data || data.length === 0 || data.every((s) => s.done)) return null;
  const left = data.filter((s) => !s.done).length;
  return (
    <Card title={`Set up your shop — ${left} step${left === 1 ? "" : "s"} left`}>
      <ul className="space-y-2">
        {data.map((s) => (
          <li key={s.text} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={s.done ? "text-neutral-400 line-through" : ""}>{s.done ? "✅" : "⬜"} {s.text}</span>
            {!s.done && <Link href={s.href} className="font-semibold text-[#D7263D] underline">{s.action}</Link>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Body() {
  const perms = usePerms();
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const finance = perms.has("finance.view");
  const { data, error, loading } = useLoad(async () => {
    const r = range(from, to);
    const d = await rpc<Dash>("admin_dashboard", r);
    const s = finance ? await rpc<Point[]>("admin_sales_series", r) : [];
    return { d, s };
  }, [from, to, finance]);

  const todos = useLoad(loadTodos, []);
  const d = data?.d;
  const series = data?.s ?? [];
  const max = Math.max(1, ...series.map((p) => p.net_paise));

  return (
    <>
      <PageHeader title="Home" subtitle="Today at a glance. Figures come straight from real orders, payments and stock."
        actions={<div className="flex items-center gap-2 text-sm">
          <input aria-label="From" type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span>to</span>
          <input aria-label="To" type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>} />
      <div className="mb-5"><SetupChecklist /></div>
      {error && <Notice>{error}</Notice>}
      {loading && !d && <Loading />}
      {d && (
        <div className="space-y-5">
          {todos.data && todos.data.length > 0 && (
            <Card title="Needs attention">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {todos.data.map((t) => (
                  <Link key={t.label} href={t.href}
                    className={`rounded-xl border p-3 transition hover:shadow-sm ${t.count > 0 ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className={`text-2xl font-bold ${t.count > 0 ? "text-amber-800" : "text-neutral-400"}`}>{t.count}</div>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-xs text-neutral-500">{t.hint}</div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Orders" value={d.orders.total} />
            <Stat label="Completed" value={d.orders.completed} />
            <Stat label="In progress" value={d.orders.pending} />
            <Stat label="Cancelled" value={d.orders.cancelled} />
            <Stat label="Paid orders" value={d.orders.paid} hint="Captured online or COD collected" />
          </div>

          {d.sales ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Gross sales" value={rupees(d.sales.gross_sales_paise)} hint="Paid orders, before discounts" />
              <Stat label="Discounts" value={rupees(d.sales.discounts_paise)} />
              <Stat label="Refunds processed" value={rupees(d.sales.refunds_paise)} />
              <Stat label="Net sales" value={rupees(d.sales.net_sales_paise)} hint="Gross - discounts - refunds" />
              <Stat label="Average order value" value={rupees(d.sales.average_order_value_paise)} />
              <Stat label="Collected online" value={rupees(d.sales.collected_online_paise)} hint="Razorpay captured payments" />
              <Stat label="COD reconciled" value={rupees(d.sales.cod_reconciled_paise)} />
              <Stat label="COD pending" value={rupees(d.sales.cod_pending_paise)} hint="Collected by courier or due on delivery" />
            </div>
          ) : (
            <Notice kind="info">Sales and profit figures need the finance.view permission.</Notice>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Units in stock" value={d.inventory.units_in_stock} />
            <Stat label="Stock value (at price)" value={rupees(d.inventory.stock_value_at_price_paise)} />
            <Stat label="Reserved units" value={d.inventory.reserved_units} />
            <Stat label="Low-stock models" value={d.inventory.low_stock_models} hint="1 or fewer units left" />
          </div>

          {d.profit && (
            <Card title="Unit gross profit">
              <div className="text-2xl font-bold">{rupees(d.profit.unit_gross_profit_paise)}</div>
              <p className="mt-1 text-xs text-neutral-500">
                Based on {d.profit.items_with_cost} of {d.profit.items_total} sold items that have a recorded acquisition cost. {d.profit.note}
              </p>
            </Card>
          )}

          {finance && (
            <Card title="Net sales per day">
              {series.length === 0 ? <Empty>No paid orders in this range.</Empty> : (
                <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily net sales bar chart">
                  {series.map((p) => (
                    <div key={p.day} className="group relative flex-1" title={`${p.day}: ${rupees(p.net_paise)} (${p.orders} orders)`}>
                      <div className="rounded-t bg-[#D7263D]" style={{ height: `${Math.max(2, (p.net_paise / max) * 100)}%` }} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Top models">
              {d.top_models.length === 0 ? <Empty>No sales yet.</Empty> : d.top_models.map((m) => (
                <div key={m.model} className="flex justify-between border-b border-neutral-100 py-1.5 text-sm last:border-0">
                  <span>{m.model}</span><span className="text-neutral-500">{m.units} sold · {rupees(m.revenue_paise)}</span>
                </div>
              ))}
            </Card>
            <Card title="Top brands">
              {d.top_brands.length === 0 ? <Empty>No sales yet.</Empty> : d.top_brands.map((m) => (
                <div key={m.brand} className="flex justify-between border-b border-neutral-100 py-1.5 text-sm last:border-0">
                  <span>{m.brand}</span><span className="text-neutral-500">{m.units} sold · {rupees(m.revenue_paise)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return <Guard perm="reports.view"><Body /></Guard>;
}
