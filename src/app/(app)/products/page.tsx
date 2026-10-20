"use client";
import Link from "next/link";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Empty, Loading, Notice, PageHeader, Table, Td } from "@/components/ui";
import { errText, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { label } from "@/lib/format";

async function load() {
  const db = supabaseBrowser();
  const [models, brands, variants, units, images] = await Promise.all([
    db.from("product_models").select("id,name,status,network,release_year,brand_id").order("created_at", { ascending: false }),
    db.from("brands").select("id,name,is_active"),
    db.from("product_variants").select("id,model_id,status"),
    db.from("admin_inventory_units").select("model_id,status").limit(5000),
    db.from("product_images").select("model_id").not("model_id", "is", null).limit(5000),
  ]);
  for (const r of [models, brands, variants, units, images]) if (r.error) throw r.error;
  return {
    models: (models.data ?? []) as Row[], brands: (brands.data ?? []) as Row[], variants: (variants.data ?? []) as Row[],
    units: (units.data ?? []) as Row[], images: (images.data ?? []) as Row[],
  };
}

type Data = Awaited<ReturnType<typeof load>>;

/** Why a phone is or is not visible in the app. The app lists a model only when it is published, its brand is active, and it has an available unit. */
function shopState(d: Data, m: Row): { live: boolean; why: string } {
  const brand = d.brands.find((b) => b.id === m.brand_id);
  const variants = d.variants.filter((v) => v.model_id === m.id && v.status === "active");
  const units = d.units.filter((u) => u.model_id === m.id);
  const available = units.filter((u) => u.status === "available").length;
  if (m.status === "archived") return { live: false, why: "Archived" };
  if (brand && brand.is_active === false) return { live: false, why: "Brand is switched off" };
  if (variants.length === 0) return { live: false, why: "Add storage and colour" };
  if (units.length === 0) return { live: false, why: "Add a phone unit with a price" };
  if (available === 0) return { live: false, why: units.some((u) => u.status === "draft") ? "Unit is still a draft: set it to Available" : "No unit is available" };
  if (m.status !== "published") return { live: false, why: "Not published yet" };
  return { live: true, why: `${available} in stock` };
}

function Body() {
  const perms = usePerms();
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<string | null>(null);

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
      <PageHeader title="Phones" subtitle="Everything you sell. “In the app” shows whether customers can see a phone, and what is missing if they cannot."
        actions={perms.has("products.create") ? <Link href="/products/new"><Btn>Add a phone</Btn></Link> : null} />
      {(error || msg) && <Notice>{error ?? msg}</Notice>}
      {loading && !data && <Loading />}
      {data && (data.models.length === 0 ? <Empty>No phones yet. Press “Add a phone” to add your first one.</Empty> : (
        <Table head={["Phone", "Brand", "Photos", "In the app", ""]}>
          {data.models.map((m) => {
            const s = shopState(data, m);
            const photos = data.images.filter((i) => i.model_id === m.id).length;
            return (
              <tr key={String(m.id)}>
                <Td>
                  <Link className="font-semibold text-[#D7263D] underline" href={`/products/${String(m.id)}`}>{String(m.name)}</Link>
                  <div className="text-xs text-neutral-500">{String(m.network ?? "")}{m.release_year ? ` · ${String(m.release_year)}` : ""}</div>
                </Td>
                <Td>{brandName(m.brand_id)}</Td>
                <Td>{photos === 0 ? <span className="text-amber-700">None</span> : photos}</Td>
                <Td>
                  <Badge tone={s.live ? "green" : m.status === "archived" ? "red" : "amber"}>{s.live ? "Live" : label(String(m.status)) === "Published" ? "Published, not visible" : "Not visible"}</Badge>
                  <div className="mt-0.5 text-xs text-neutral-500">{s.why}</div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/products/${String(m.id)}`}><Btn kind="ghost">Open</Btn></Link>
                    {m.status !== "published" && m.status !== "archived" && perms.has("products.publish") && <Btn kind="ghost" onClick={() => setStatus(String(m.id), "published")}>Publish</Btn>}
                    {m.status === "published" && perms.has("products.publish") && <Btn kind="ghost" onClick={() => setStatus(String(m.id), "draft")}>Hide</Btn>}
                    {m.status !== "archived" && perms.has("products.archive") && <Btn kind="danger" onClick={() => { if (window.confirm(`Remove ${String(m.name)} from the shop? Order history is kept.`)) void setStatus(String(m.id), "archived"); }}>Remove</Btn>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      ))}
    </>
  );
}

export default function ProductsPage() {
  return <Guard perm="products.read"><Body /></Guard>;
}
