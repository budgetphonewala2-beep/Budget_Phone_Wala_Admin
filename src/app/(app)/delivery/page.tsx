"use client";
import { useState } from "react";
import { Guard } from "@/components/shell";
import { Badge, Btn, Card, Empty, Field, Loading, Notice, PageHeader, Table, Td, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toPaise } from "@/lib/format";

const money = (p: unknown) => (p == null || p === "" ? "" : String(Number(p) / 100));

async function load() {
  const db = supabaseBrowser();
  const [s, z, p] = await Promise.all([
    db.from("store_settings").select("*").eq("id", 1).single(),
    db.from("delivery_zones").select("*").order("name"),
    db.from("delivery_zone_pincodes").select("*"),
  ]);
  for (const r of [s, z, p]) if (r.error) throw r.error;
  return { s: s.data as Row, zones: (z.data ?? []) as Row[], pins: (p.data ?? []) as Row[] };
}

function Body() {
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [f, setF] = useState<Record<string, string | boolean> | null>(null);
  const [zone, setZone] = useState({ name: "", fee: "", free: "", cod: true, serviceable: true, pins: "" });

  if (data && !f) {
    const s = data.s;
    setF({
      delivery_enabled: Boolean(s.delivery_enabled), delivery_default_fee: money(s.delivery_default_fee_paise), free_threshold: money(s.free_delivery_threshold_paise),
      unlisted: Boolean(s.delivery_unlisted_pincodes_serviceable), pickup_enabled: Boolean(s.pickup_enabled), pickup_fee: money(s.pickup_fee_paise),
      cod_enabled: Boolean(s.cod_enabled), cod_min: money(s.cod_min_paise), cod_max: money(s.cod_max_paise), cod_fee: money(s.cod_fee_paise), cod_block: String(s.cod_block_after_failed ?? ""),
    });
  }

  async function saveSettings() {
    if (!f) return;
    try {
      const amt = (k: string) => { const v = toPaise(String(f[k])); if (Number.isNaN(v)) throw new Error("Amounts must look like 99 or 99.50"); return v; };
      await rpc("admin_update_settings", { p: {
        delivery_enabled: f.delivery_enabled, delivery_default_fee_paise: amt("delivery_default_fee") ?? 0, free_delivery_threshold_paise: amt("free_threshold") ?? "",
        delivery_unlisted_pincodes_serviceable: f.unlisted, pickup_enabled: f.pickup_enabled, pickup_fee_paise: amt("pickup_fee") ?? 0,
        cod_enabled: f.cod_enabled, cod_min_paise: amt("cod_min") ?? 0, cod_max_paise: amt("cod_max") ?? 0, cod_fee_paise: amt("cod_fee") ?? 0,
        cod_block_after_failed: f.cod_block ? Number(f.cod_block) : 0,
      } });
      setMsg({ kind: "ok", text: "Delivery and COD rules saved. Checkout uses these immediately." });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  async function addZone() {
    try {
      const fee = toPaise(zone.fee), free = toPaise(zone.free);
      if (zone.name.trim().length < 2) throw new Error("Zone name is required");
      if (fee == null || Number.isNaN(fee) || Number.isNaN(free)) throw new Error("Enter the delivery fee");
      const pins = zone.pins.split(/[\s,]+/).filter(Boolean);
      if (pins.some((p) => !/^\d{6}$/.test(p))) throw new Error("PIN codes must be 6 digits");
      const db = supabaseBrowser();
      const { data: z, error: e } = await db.from("delivery_zones").insert({
        name: zone.name.trim(), fee_paise: fee, free_threshold_paise: free, cod_allowed: zone.cod, is_serviceable: zone.serviceable, is_active: true,
      }).select("id").single();
      if (e) throw e;
      if (pins.length) {
        const r = await db.from("delivery_zone_pincodes").upsert(pins.map((pincode) => ({ pincode, zone_id: z.id })), { onConflict: "pincode" });
        if (r.error) throw r.error;
      }
      setZone({ name: "", fee: "", free: "", cod: true, serviceable: true, pins: "" });
      setMsg({ kind: "ok", text: "Zone added." });
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  async function toggleZone(id: string, active: boolean) {
    const { error: e } = await supabaseBrowser().from("delivery_zones").update({ is_active: active }).eq("id", id);
    if (e) setMsg({ kind: "error", text: errText(e) }); else await reload();
  }

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...(p ?? {}), [k]: v }));
  const text = (k: string) => String(f?.[k] ?? "");

  return (
    <>
      <PageHeader title="Delivery, pickup & COD" subtitle="Fees and COD eligibility are calculated by the server at checkout from these rules, never by the app." />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      {loading && !data && <Loading />}
      {data && f && (
        <div className="space-y-5">
          <Card title="Rules">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.delivery_enabled)} onChange={(e) => set("delivery_enabled", e.target.checked)} />Home delivery on</label>
              <Field label="Default delivery fee (₹)"><input className={inputCls} inputMode="decimal" value={text("delivery_default_fee")} onChange={(e) => set("delivery_default_fee", e.target.value)} /></Field>
              <Field label="Free delivery above (₹)" hint="Blank = never free"><input className={inputCls} inputMode="decimal" value={text("free_threshold")} onChange={(e) => set("free_threshold", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.unlisted)} onChange={(e) => set("unlisted", e.target.checked)} />Deliver to PIN codes not listed in a zone</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.pickup_enabled)} onChange={(e) => set("pickup_enabled", e.target.checked)} />Store pickup on</label>
              <Field label="Pickup fee (₹)"><input className={inputCls} inputMode="decimal" value={text("pickup_fee")} onChange={(e) => set("pickup_fee", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.cod_enabled)} onChange={(e) => set("cod_enabled", e.target.checked)} />Cash on delivery on</label>
              <Field label="COD minimum order (₹)"><input className={inputCls} inputMode="decimal" value={text("cod_min")} onChange={(e) => set("cod_min", e.target.value)} /></Field>
              <Field label="COD maximum order (₹)"><input className={inputCls} inputMode="decimal" value={text("cod_max")} onChange={(e) => set("cod_max", e.target.value)} /></Field>
              <Field label="COD handling fee (₹)"><input className={inputCls} inputMode="decimal" value={text("cod_fee")} onChange={(e) => set("cod_fee", e.target.value)} /></Field>
              <Field label="Block COD after N failed deliveries" hint="0 = never"><input className={inputCls} inputMode="numeric" value={text("cod_block")} onChange={(e) => set("cod_block", e.target.value)} /></Field>
            </div>
            <div className="mt-3"><Btn onClick={saveSettings}>Save rules</Btn></div>
          </Card>

          <Card title="Zones">
            {data.zones.length === 0 ? <Empty>No zones. Without zones, the default fee applies everywhere.</Empty> : (
              <Table head={["Zone", "Fee", "Free above", "COD", "Serviceable", "PIN codes", ""]}>
                {data.zones.map((z) => (
                  <tr key={String(z.id)}>
                    <Td>{String(z.name)} {!z.is_active && <Badge>Inactive</Badge>}</Td>
                    <Td>₹{money(z.fee_paise)}</Td><Td>{z.free_threshold_paise ? `₹${money(z.free_threshold_paise)}` : "-"}</Td>
                    <Td>{z.cod_allowed ? "Yes" : "No"}</Td><Td>{z.is_serviceable ? "Yes" : "No"}</Td>
                    <Td className="max-w-xs break-words text-xs">{data.pins.filter((p) => p.zone_id === z.id).map((p) => String(p.pincode)).join(", ") || "-"}</Td>
                    <Td><Btn kind="ghost" onClick={() => toggleZone(String(z.id), !z.is_active)}>{z.is_active ? "Deactivate" : "Activate"}</Btn></Td>
                  </tr>
                ))}
              </Table>
            )}
            <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-3">
              <Field label="New zone name"><input className={inputCls} value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} /></Field>
              <Field label="Fee (₹)"><input className={inputCls} inputMode="decimal" value={zone.fee} onChange={(e) => setZone({ ...zone, fee: e.target.value })} /></Field>
              <Field label="Free above (₹)"><input className={inputCls} inputMode="decimal" value={zone.free} onChange={(e) => setZone({ ...zone, free: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="PIN codes (comma or space separated)"><input className={inputCls} value={zone.pins} onChange={(e) => setZone({ ...zone, pins: e.target.value })} /></Field></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zone.cod} onChange={(e) => setZone({ ...zone, cod: e.target.checked })} />COD allowed</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zone.serviceable} onChange={(e) => setZone({ ...zone, serviceable: e.target.checked })} />Serviceable</label>
              <div><Btn onClick={addZone}>Add zone</Btn></div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default function DeliveryPage() {
  return <Guard perm="delivery.configure"><Body /></Guard>;
}
