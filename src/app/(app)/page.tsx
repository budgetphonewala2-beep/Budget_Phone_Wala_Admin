"use client";
import { useState } from "react";
import { Guard } from "@/components/shell";
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

function range(from: string, to: string) {
  // IST day boundaries expressed as absolute timestamps; `to` is inclusive of the chosen day
  const f = new Date(`${from}T00:00:00+05:30`);
  const t = new Date(`${to}T00:00:00+05:30`);
  t.setDate(t.getDate() + 1);
  return { p_from: f.toISOString(), p_to: t.toISOString() };
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

  const d = data?.d;
  const series = data?.s ?? [];
  const max = Math.max(1, ...series.map((p) => p.net_paise));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="All figures are computed in the database from real orders, payments and stock."
        actions={<div className="flex items-center gap-2 text-sm">
          <input aria-label="From" type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span>to</span>
          <input aria-label="To" type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>} />
      {error && <Notice>{error}</Notice>}
      {loading && !d && <Loading />}
      {d && (
        <div className="space-y-5">
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
