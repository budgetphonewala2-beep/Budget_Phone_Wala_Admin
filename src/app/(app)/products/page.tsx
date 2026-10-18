"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls, statusTone } from "@/components/ui";
import { errText, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { label } from "@/lib/format";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function load() {
  const db = supabaseBrowser();
  const [models, brands, variants] = await Promise.all([
    db.from("product_models").select("id,name,slug,status,network,release_year,brand_id,cod_allowed,published_at").order("created_at", { ascending: false }),
    db.from("brands").select("id,name").order("name"),
    db.from("product_variants").select("id,model_id"),
  ]);
  for (const r of [models, brands, variants]) if (r.error) throw r.error;
  return { models: (models.data ?? []) as Row[], brands: (brands.data ?? []) as Row[], variants: (variants.data ?? []) as Row[] };
}

function Body() {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(load, []);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", brandId: "", newBrand: "", network: "4G", year: "", description: "" });
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const db = supabaseBrowser();
      let brandId = form.brandId;
      if (!brandId && form.newBrand.trim()) {
        const { data: b, error: be } = await db.from("brands").insert({ name: form.newBrand.trim(), slug: slugify(form.newBrand) }).select("id").single();
        if (be) throw be;
        brandId = String(b.id);
      }
      if (!brandId) throw new Error("Choose a brand or type a new one");
      if (form.name.trim().length < 2) throw new Error("Enter the model name");
      const { error: e } = await db.from("product_models").insert({
        brand_id: brandId, name: form.name.trim(), slug: slugify(`${form.name}-${Date.now().toString(36)}`),
        network: form.network, release_year: form.year ? Number(form.year) : null, description: form.description, status: "draft",
      });
      if (e) throw e;
      setOpen(false);
      setForm({ name: "", brandId: "", newBrand: "", network: "4G", year: "", description: "" });
      await reload();
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setMsg(null);
    const patch: Row = { status };
    if (status === "published") patch.published_at = new Date().toISOString();
    const { error: e } = await supabaseBrowser().from("product_models").update(patch).eq("id", id);
    if (e) setMsg(errText(e));
    else await reload();
  }

  const brandName = (id: unknown) => String(data?.brands.find((b) => b.id === id)?.name ?? "-");

  return (
    <>
      <PageHeader title="Products & units" subtitle="Models group the phones customers see. Each physical phone is a unit with its own price, condition and IMEI."
        actions={perms.has("products.create") ? <Btn onClick={() => setOpen(true)}>New model</Btn> : null} />
      {(error || msg) && <Notice>{error ?? msg}</Notice>}
      {loading && !data && <Loading />}
      {data && (data.models.length === 0 ? <Empty>No models yet.</Empty> : (
        <Table head={["Model", "Brand", "Network", "Variants", "Status", ""]}>
          {data.models.map((m) => (
            <tr key={String(m.id)} className="hover:bg-neutral-50">
              <Td><Link className="font-semibold text-[#D7263D] underline" href={`/products/${String(m.id)}`}>{String(m.name)}</Link></Td>
              <Td>{brandName(m.brand_id)}</Td>
              <Td>{String(m.network ?? "-")}{m.release_year ? ` · ${String(m.release_year)}` : ""}</Td>
              <Td>{data.variants.filter((v) => v.model_id === m.id).length}</Td>
              <Td><Badge tone={statusTone(String(m.status))}>{label(String(m.status))}</Badge></Td>
              <Td>
                <div className="flex gap-1.5">
                  {m.status !== "published" && perms.has("products.publish") && <Btn kind="ghost" onClick={() => setStatus(String(m.id), "published")}>Publish</Btn>}
                  {m.status === "published" && perms.has("products.publish") && <Btn kind="ghost" onClick={() => setStatus(String(m.id), "draft")}>Unpublish</Btn>}
                  {m.status !== "archived" && perms.has("products.archive") && <Btn kind="danger" onClick={() => { if (window.confirm(`Archive ${String(m.name)}? It disappears from the shop; order history is kept.`)) void setStatus(String(m.id), "archived"); }}>Archive</Btn>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      ))}
      {open && data && (
        <Modal title="New model" onClose={() => setOpen(false)}>
          {msg && <Notice>{msg}</Notice>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Model name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="iPhone 13" /></Field>
            <Field label="Brand">
              <select className={inputCls} value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                <option value="">Choose…</option>
                {data.brands.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>)}
              </select>
            </Field>
            <Field label="…or new brand"><input className={inputCls} value={form.newBrand} onChange={(e) => setForm({ ...form, newBrand: e.target.value })} /></Field>
            <Field label="Network"><select className={inputCls} value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}><option>4G</option><option>5G</option></select></Field>
            <Field label="Release year"><input className={inputCls} inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          </div>
          <div className="mt-4 flex gap-2"><Btn disabled={busy} onClick={create}>Create draft</Btn><Btn kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
        </Modal>
      )}
    </>
  );
}

export default function ProductsPage() {
  return <Guard perm="products.read"><Body /></Guard>;
}
