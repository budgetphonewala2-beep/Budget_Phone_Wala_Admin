"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { label, rupees, toPaise } from "@/lib/format";

async function load(id: string) {
  const db = supabaseBrowser();
  const [m, v, u, img] = await Promise.all([
    db.from("product_models").select("*").eq("id", id).single(),
    db.from("product_variants").select("*").eq("model_id", id).order("storage_gb"),
    db.from("admin_inventory_units").select("*").eq("model_id", id).order("created_at", { ascending: false }),
    db.from("product_images").select("*").eq("model_id", id).order("sort_order"),
  ]);
  for (const r of [m, v, u, img]) if (r.error) throw r.error;
  return { model: m.data as Row, variants: (v.data ?? []) as Row[], units: (u.data ?? []) as Row[], images: (img.data ?? []) as Row[] };
}

type UnitForm = {
  id?: string; variant_id: string; condition_grade: string; battery: string; price: string; mrp: string; cost: string; imei: string;
  has_bill: boolean; has_box: boolean; accessories: string; defects: string; status: string; warranty: string;
};
const emptyUnit: UnitForm = { variant_id: "", condition_grade: "A", battery: "", price: "", mrp: "", cost: "", imei: "", has_bill: false, has_box: false, accessories: "", defects: "", status: "draft", warranty: "" };
const MANUAL = ["draft", "available", "inspection", "returned_repair", "unavailable", "archived"];

function Body({ id }: { id: string }) {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(() => load(id), [id]);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [unit, setUnit] = useState<UnitForm | null>(null);
  const [vf, setVf] = useState({ storage: "128", ram: "4", color: "" });
  const [busy, setBusy] = useState(false);
  const canImei = perms.has("inventory.imei.view");
  const canCost = perms.has("inventory.cost.view");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: ok }); await reload(); } catch (e) { setMsg({ kind: "error", text: errText(e) }); } finally { setBusy(false); }
  }

  async function addVariant() {
    const storage = Number(vf.storage);
    if (!storage || vf.color.trim().length < 2) return setMsg({ kind: "error", text: "Storage and colour are required." });
    await run(async () => {
      const { error: e } = await supabaseBrowser().from("product_variants").insert({
        model_id: id, storage_gb: storage, ram_gb: vf.ram ? Number(vf.ram) : null, color: vf.color.trim(), status: "active",
      });
      if (e) throw e;
      setVf({ ...vf, color: "" });
    }, "Variant added.");
  }

  async function saveUnit() {
    if (!unit) return;
    const price = toPaise(unit.price);
    const mrp = toPaise(unit.mrp);
    const cost = toPaise(unit.cost);
    if (!unit.variant_id) return setMsg({ kind: "error", text: "Choose a variant." });
    if (price == null || Number.isNaN(price) || price <= 0) return setMsg({ kind: "error", text: "Enter a valid selling price." });
    if (Number.isNaN(mrp) || Number.isNaN(cost)) return setMsg({ kind: "error", text: "MRP and cost must be amounts like 12999 or 12999.50." });
    if (unit.imei && !/^\d{15}$/.test(unit.imei.trim())) return setMsg({ kind: "error", text: "IMEI must be 15 digits." });
    const body: Row = {
      id: unit.id, variant_id: unit.variant_id, condition_grade: unit.condition_grade,
      battery_health_pct: unit.battery ? Number(unit.battery) : null, selling_price_paise: price, mrp_paise: mrp,
      has_bill: unit.has_bill, has_box: unit.has_box, accessories: unit.accessories, defects_notes: unit.defects,
      warranty_months_override: unit.warranty ? Number(unit.warranty) : null,
    };
    if (!unit.id) body.status = unit.status;
    if (canCost && unit.cost !== "") body.acquisition_cost_paise = cost;
    if (canImei && unit.imei) body.imei = unit.imei.trim();
    await run(async () => {
      await rpc("admin_upsert_unit", { p: body });
      setUnit(null);
    }, unit.id ? "Unit updated (price changes are audited)." : "Unit created.");
  }

  async function setUnitStatus(u: Row, to: string) {
    const reason = window.prompt(`Reason for changing ${String(u.unit_code)} to "${label(to)}" (required, kept in the audit trail):`);
    if (!reason || reason.trim().length < 3) return;
    await run(() => rpc("admin_set_unit_status", { p_unit: u.id, p_to: to, p_reason: reason.trim() }), "Unit status updated.");
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    await run(async () => {
      const db = supabaseBrowser();
      let order = (data?.images.length ?? 0) + 1;
      for (const f of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new Error(`${f.name}: only JPG, PNG or WebP`);
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name}: larger than 5 MB`);
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
        const path = `models/${id}/${crypto.randomUUID()}.${ext}`;
        const up = await db.storage.from("product-images").upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) throw up.error;
        const ins = await db.from("product_images").insert({ model_id: id, storage_path: path, sort_order: order++, is_primary: (data?.images.length ?? 0) === 0 && order === 2, alt: String(data?.model.name ?? "") });
        if (ins.error) throw ins.error;
      }
    }, "Photos uploaded.");
  }

  async function makePrimary(imgId: string) {
    await run(async () => {
      const db = supabaseBrowser();
      const a = await db.from("product_images").update({ is_primary: false }).eq("model_id", id);
      if (a.error) throw a.error;
      const b = await db.from("product_images").update({ is_primary: true }).eq("id", imgId);
      if (b.error) throw b.error;
    }, "Primary photo set.");
  }

  async function removeImage(img: Row) {
    if (!window.confirm("Delete this photo?")) return;
    await run(async () => {
      const db = supabaseBrowser();
      const d = await db.from("product_images").delete().eq("id", img.id);
      if (d.error) throw d.error;
      await db.storage.from("product-images").remove([String(img.storage_path)]);
    }, "Photo deleted.");
  }

  if (error) return <Notice>{error}</Notice>;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const { model, variants, units, images } = data;
  const pub = (path: string) => supabaseBrowser().storage.from("product-images").getPublicUrl(path).data.publicUrl;
  const vName = (u: Row) => `${String(u.storage_gb)}GB · ${String(u.color)}`;

  return (
    <>
      <PageHeader title={String(model.name)} subtitle={`Status: ${label(String(model.status))}`} actions={<Link href="/products"><Btn kind="ghost">All models</Btn></Link>} />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="space-y-4">
        <Card title="Photos">
          <div className="flex flex-wrap gap-3">
            {images.map((i) => (
              <div key={String(i.id)} className="w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pub(String(i.storage_path))} alt={String(i.alt ?? "")} className="h-28 w-28 rounded-xl border border-neutral-200 object-cover" />
                <div className="mt-1 flex items-center justify-between text-xs">
                  {i.is_primary ? <Badge tone="green">Primary</Badge> : perms.has("products.update") ? <button className="underline" onClick={() => makePrimary(String(i.id))}>Make primary</button> : null}
                  {perms.has("products.update") && <button className="text-red-700" aria-label="Delete photo" onClick={() => removeImage(i)}>Delete</button>}
                </div>
              </div>
            ))}
            {images.length === 0 && <p className="text-sm text-neutral-500">No photos yet. Phones without photos look unfinished in the shop.</p>}
          </div>
          {perms.has("products.update") && (
            <div className="mt-3"><input aria-label="Upload photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => upload(e.target.files)} /></div>
          )}
        </Card>

        <Card title="Variants (storage / colour)">
          <div className="mb-3 flex flex-wrap gap-2">
            {variants.length === 0 && <span className="text-sm text-neutral-500">Add a variant before adding units.</span>}
            {variants.map((v) => <Badge key={String(v.id)}>{String(v.storage_gb)}GB / {String(v.ram_gb ?? "-")}GB · {String(v.color)}</Badge>)}
          </div>
          {perms.has("products.update") && (
            <div className="grid max-w-2xl gap-2 sm:grid-cols-4">
              <Field label="Storage (GB)"><input className={inputCls} inputMode="numeric" value={vf.storage} onChange={(e) => setVf({ ...vf, storage: e.target.value })} /></Field>
              <Field label="RAM (GB)"><input className={inputCls} inputMode="numeric" value={vf.ram} onChange={(e) => setVf({ ...vf, ram: e.target.value })} /></Field>
              <Field label="Colour"><input className={inputCls} value={vf.color} onChange={(e) => setVf({ ...vf, color: e.target.value })} /></Field>
              <div className="flex items-end"><Btn disabled={busy} onClick={addVariant}>Add variant</Btn></div>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Units</h2>
          {perms.has("products.create") && <Btn disabled={variants.length === 0} onClick={() => setUnit({ ...emptyUnit, variant_id: String(variants[0]?.id ?? "") })}>Add unit</Btn>}
        </div>
        {units.length === 0 ? <Empty>No units for this model.</Empty> : (
          <Table head={["Code", "Variant", "Grade", "Battery", "Price", "IMEI", "Status", ""]}>
            {units.map((u) => (
              <tr key={String(u.id)}>
                <Td className="font-mono text-xs">{String(u.unit_code)}</Td>
                <Td>{vName(u)}</Td>
                <Td>{String(u.condition_grade)}</Td>
                <Td>{u.battery_health_pct ? `${String(u.battery_health_pct)}%` : "-"}</Td>
                <Td>{rupees(Number(u.selling_price_paise))}{canCost && u.acquisition_cost_paise != null ? <div className="text-xs text-neutral-500">cost {rupees(Number(u.acquisition_cost_paise))}</div> : null}</Td>
                <Td className="font-mono text-xs">{String(u.imei_masked ?? "-")}</Td>
                <Td><Badge tone={statusTone(String(u.status))}>{label(String(u.status))}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.has("products.update") && !["sold", "reserved"].includes(String(u.status)) && (
                      <Btn kind="ghost" onClick={() => setUnit({
                        id: String(u.id), variant_id: String(u.variant_id), condition_grade: String(u.condition_grade), battery: String(u.battery_health_pct ?? ""),
                        price: String(Number(u.selling_price_paise) / 100), mrp: u.mrp_paise ? String(Number(u.mrp_paise) / 100) : "",
                        cost: u.acquisition_cost_paise != null ? String(Number(u.acquisition_cost_paise) / 100) : "", imei: "", has_bill: Boolean(u.has_bill), has_box: Boolean(u.has_box),
                        accessories: String(u.accessories ?? ""), defects: String(u.defects_notes ?? ""), status: String(u.status), warranty: String(u.warranty_months_override ?? ""),
                      })}>Edit</Btn>
                    )}
                    {perms.has("inventory.adjust") && !["sold", "reserved"].includes(String(u.status)) && (
                      <select aria-label="Change status" className="rounded-lg border border-neutral-300 px-1 py-1 text-xs" value="" onChange={(e) => e.target.value && setUnitStatus(u, e.target.value)}>
                        <option value="">Status…</option>
                        {MANUAL.filter((s) => s !== u.status).map((s) => <option key={s} value={s}>{label(s)}</option>)}
                      </select>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {unit && (
        <Modal title={unit.id ? "Edit unit" : "Add unit"} onClose={() => setUnit(null)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Variant"><select className={inputCls} value={unit.variant_id} disabled={Boolean(unit.id)} onChange={(e) => setUnit({ ...unit, variant_id: e.target.value })}>
              {variants.map((v) => <option key={String(v.id)} value={String(v.id)}>{String(v.storage_gb)}GB · {String(v.color)}</option>)}</select></Field>
            <Field label="Condition grade"><select className={inputCls} value={unit.condition_grade} onChange={(e) => setUnit({ ...unit, condition_grade: e.target.value })}>{["A+", "A", "B", "C"].map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Selling price (₹)"><input className={inputCls} inputMode="decimal" value={unit.price} onChange={(e) => setUnit({ ...unit, price: e.target.value })} /></Field>
            <Field label="MRP (₹)"><input className={inputCls} inputMode="decimal" value={unit.mrp} onChange={(e) => setUnit({ ...unit, mrp: e.target.value })} /></Field>
            <Field label="Battery health (%)"><input className={inputCls} inputMode="numeric" value={unit.battery} onChange={(e) => setUnit({ ...unit, battery: e.target.value })} /></Field>
            <Field label="Warranty override (months)" hint="Blank uses the store default"><input className={inputCls} inputMode="numeric" value={unit.warranty} onChange={(e) => setUnit({ ...unit, warranty: e.target.value })} /></Field>
            {canCost && <Field label="Acquisition cost (₹)" hint="Never shown to customers"><input className={inputCls} inputMode="decimal" value={unit.cost} onChange={(e) => setUnit({ ...unit, cost: e.target.value })} /></Field>}
            {canImei && <Field label="IMEI (15 digits)" hint={unit.id ? "Leave blank to keep the stored value" : undefined}><input className={inputCls} inputMode="numeric" value={unit.imei} onChange={(e) => setUnit({ ...unit, imei: e.target.value })} autoComplete="off" /></Field>}
            <Field label="Accessories"><input className={inputCls} value={unit.accessories} onChange={(e) => setUnit({ ...unit, accessories: e.target.value })} /></Field>
            <Field label="Defects / notes (shown to customers)"><input className={inputCls} value={unit.defects} onChange={(e) => setUnit({ ...unit, defects: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unit.has_bill} onChange={(e) => setUnit({ ...unit, has_bill: e.target.checked })} />Original bill</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unit.has_box} onChange={(e) => setUnit({ ...unit, has_box: e.target.checked })} />Original box</label>
            {!unit.id && (
              <Field label="Start as" hint="Available publishes the unit to the shop immediately"><select className={inputCls} value={unit.status} onChange={(e) => setUnit({ ...unit, status: e.target.value })}>
                <option value="draft">Draft</option>{perms.has("products.publish") && <option value="available">Available (publish now)</option>}</select></Field>
            )}
          </div>
          <div className="mt-4 flex gap-2"><Btn disabled={busy} onClick={saveUnit}>Save unit</Btn><Btn kind="ghost" onClick={() => setUnit(null)}>Cancel</Btn></div>
        </Modal>
      )}
    </>
  );
}

export default function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Guard perm="products.read"><Body id={id} /></Guard>;
}
