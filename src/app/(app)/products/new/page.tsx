"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Btn, Card, Field, Notice, PageHeader, inputCls } from "@/components/ui";
import { errText, rpc, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { uploadProductPhoto } from "@/lib/photos";
import { toPaise } from "@/lib/format";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const MAX_PHOTOS = 8;
const STORAGE = ["16", "32", "64", "128", "256", "512", "1024"];
const RAM = ["", "1", "2", "3", "4", "6", "8", "12", "16"];

const blank = {
  brandId: "", newBrand: "", name: "", network: "4G", year: "", storage: "128", ram: "4", color: "", grade: "A", battery: "",
  price: "", mrp: "", accessories: "", defects: "", hasBill: false, hasBox: false, cost: "", imei: "", publish: true,
};

function Body() {
  const perms = usePerms();
  const canPublish = perms.has("products.publish");
  const [brands, setBrands] = useState<Row[]>([]);
  const [f, setF] = useState({ ...blank, publish: canPublish });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [saved, setSaved] = useState<{ id: string; live: boolean; photos: number; failed: string[] } | null>(null);
  const previews = useMemo(() => files.map((x) => URL.createObjectURL(x)), [files]);

  useEffect(() => {
    supabaseBrowser().from("brands").select("id,name").order("name").then(({ data }) => setBrands((data ?? []) as Row[]));
  }, []);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = (k: keyof typeof blank, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)];
    if (next.length > MAX_PHOTOS) setMsg({ kind: "error", text: `You can add up to ${MAX_PHOTOS} photos. The first ${MAX_PHOTOS} were kept.` });
    setFiles(next.slice(0, MAX_PHOTOS));
  }

  async function save() {
    setMsg(null);
    const price = toPaise(f.price);
    const mrp = toPaise(f.mrp);
    if (!f.brandId && !f.newBrand.trim()) return setMsg({ kind: "error", text: "Choose a brand, or type a new one." });
    if (f.name.trim().length < 2) return setMsg({ kind: "error", text: "Enter the model name, for example iPhone 13." });
    if (f.color.trim().length < 2) return setMsg({ kind: "error", text: "Enter the colour." });
    if (price == null || Number.isNaN(price) || price <= 0) return setMsg({ kind: "error", text: "Enter the selling price, for example 24999." });
    if (Number.isNaN(mrp)) return setMsg({ kind: "error", text: "MRP must be an amount like 12999." });
    if (f.imei && !/^\d{15}$/.test(f.imei.trim())) return setMsg({ kind: "error", text: "IMEI must be 15 digits (or leave it empty)." });

    setBusy(true);
    const db = supabaseBrowser();
    let modelId = "";
    try {
      setStep("Saving phone details…");
      let brandId = f.brandId;
      if (!brandId) {
        const nb = f.newBrand.trim();
        const existing = brands.find((b) => String(b.name).toLowerCase() === nb.toLowerCase());
        if (existing) brandId = String(existing.id);
        else {
          const { data: b, error: be } = await db.from("brands").insert({ name: nb, slug: slugify(nb) }).select("id").single();
          if (be) throw be;
          brandId = String(b.id);
        }
      }
      const { data: m, error: me } = await db.from("product_models").insert({
        brand_id: brandId, name: f.name.trim(), slug: slugify(`${f.name}-${Date.now().toString(36)}`),
        network: f.network, release_year: f.year ? Number(f.year) : null, description: "", status: "draft",
      }).select("id").single();
      if (me) throw me;
      modelId = String(m.id);

      const { data: v, error: ve } = await db.from("product_variants").insert({
        model_id: modelId, storage_gb: Number(f.storage), ram_gb: f.ram ? Number(f.ram) : null, color: f.color.trim(), status: "active",
      }).select("id").single();
      if (ve) throw ve;

      const body: Row = {
        variant_id: String(v.id), condition_grade: f.grade, battery_health_pct: f.battery ? Number(f.battery) : null,
        selling_price_paise: price, mrp_paise: mrp, has_bill: f.hasBill, has_box: f.hasBox, accessories: f.accessories, defects_notes: f.defects,
        status: f.publish && canPublish ? "available" : "draft",
      };
      if (perms.has("inventory.cost.view") && f.cost !== "") body.acquisition_cost_paise = toPaise(f.cost);
      if (perms.has("inventory.imei.view") && f.imei) body.imei = f.imei.trim();
      await rpc("admin_upsert_unit", { p: body });

      const failed: string[] = [];
      let done = 0;
      for (let i = 0; i < files.length; i++) {
        setStep(`Uploading photo ${i + 1} of ${files.length}…`);
        try {
          const ph = await uploadProductPhoto(db, modelId, files[i]);
          const ins = await db.from("product_images").insert({ model_id: modelId, ...ph, sort_order: done + 1, is_primary: done === 0, alt: f.name.trim() });
          if (ins.error) throw ins.error;
          done++;
        } catch (e) {
          failed.push(e instanceof Error ? e.message : files[i].name);
        }
      }

      let live = false;
      if (f.publish && canPublish) {
        setStep("Publishing to the app…");
        const { error: pe } = await db.from("product_models").update({ status: "published", published_at: new Date().toISOString() }).eq("id", modelId);
        if (pe) throw pe;
        live = true;
      }
      setSaved({ id: modelId, live, photos: done, failed });
    } catch (e) {
      setMsg({
        kind: "error",
        text: `${errText(e)}${modelId ? " The phone was saved as a draft; open it to finish." : ""}`,
      });
      if (modelId) setSaved({ id: modelId, live: false, photos: 0, failed: [] });
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  function another() {
    setSaved(null);
    setMsg(null);
    setFiles([]);
    setF({ ...blank, publish: canPublish, brandId: f.brandId, newBrand: "", network: f.network });
  }

  if (saved) {
    return (
      <>
        <PageHeader title="Phone saved" />
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Card>
          <p className="text-sm">
            {saved.live
              ? <>This phone is <strong>live in the app</strong> now (it may take a pull-to-refresh on the home screen to appear).</>
              : <>This phone is saved as a <strong>draft</strong>. Customers cannot see it until you publish it.</>}
          </p>
          <p className="mt-2 text-sm text-neutral-600">{saved.photos} photo{saved.photos === 1 ? "" : "s"} uploaded.</p>
          {saved.failed.length > 0 && <Notice>{`Some photos were skipped: ${saved.failed.join(" · ")}`}</Notice>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/products/${saved.id}`}><Btn>Open this phone</Btn></Link>
            <Btn kind="ghost" onClick={another}>Add another phone</Btn>
            <Link href="/products"><Btn kind="ghost">All phones</Btn></Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add a phone" subtitle="Fill this one form. The phone appears in the app as soon as you save, if “Show in the app” is on."
        actions={<Link href="/products"><Btn kind="ghost">Cancel</Btn></Link>} />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="space-y-4">
        <Card title="1. Which phone">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand">
              <select className={inputCls} value={f.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">Choose…</option>
                {brands.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>)}
              </select>
            </Field>
            <Field label="…or type a new brand" hint="Only if the brand is not in the list"><input className={inputCls} value={f.newBrand} onChange={(e) => set("newBrand", e.target.value)} placeholder="Samsung" /></Field>
            <Field label="Model name"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="iPhone 13" /></Field>
            <Field label="Network"><select className={inputCls} value={f.network} onChange={(e) => set("network", e.target.value)}><option>4G</option><option>5G</option></select></Field>
            <Field label="Storage (GB)"><select className={inputCls} value={f.storage} onChange={(e) => set("storage", e.target.value)}>{STORAGE.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="RAM (GB)"><select className={inputCls} value={f.ram} onChange={(e) => set("ram", e.target.value)}>{RAM.map((s) => <option key={s} value={s}>{s || "Not sure"}</option>)}</select></Field>
            <Field label="Colour"><input className={inputCls} value={f.color} onChange={(e) => set("color", e.target.value)} placeholder="Midnight Black" /></Field>
            <Field label="Release year (optional)"><input className={inputCls} inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="2021" /></Field>
          </div>
        </Card>

        <Card title="2. Condition and price">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Condition grade" hint="A+ like new · A very good · B good · C fair"><select className={inputCls} value={f.grade} onChange={(e) => set("grade", e.target.value)}>{["A+", "A", "B", "C"].map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Battery health (%)"><input className={inputCls} inputMode="numeric" value={f.battery} onChange={(e) => set("battery", e.target.value)} placeholder="88" /></Field>
            <Field label="Selling price (₹)"><input className={inputCls} inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="24999" /></Field>
            <Field label="Original price / MRP (₹, optional)" hint="Shown struck through"><input className={inputCls} inputMode="decimal" value={f.mrp} onChange={(e) => set("mrp", e.target.value)} /></Field>
            <Field label="Accessories included"><input className={inputCls} value={f.accessories} onChange={(e) => set("accessories", e.target.value)} placeholder="Charger, cable" /></Field>
            <Field label="Defects or notes (shown to customers)"><input className={inputCls} value={f.defects} onChange={(e) => set("defects", e.target.value)} placeholder="Tiny scratch on the back" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hasBill} onChange={(e) => set("hasBill", e.target.checked)} />Original bill available</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hasBox} onChange={(e) => set("hasBox", e.target.checked)} />Original box available</label>
            {perms.has("inventory.cost.view") && <Field label="What you paid for it (₹, private)" hint="Never shown to customers"><input className={inputCls} inputMode="decimal" value={f.cost} onChange={(e) => set("cost", e.target.value)} /></Field>}
            {perms.has("inventory.imei.view") && <Field label="IMEI (15 digits, private)"><input className={inputCls} inputMode="numeric" value={f.imei} onChange={(e) => set("imei", e.target.value)} autoComplete="off" /></Field>}
          </div>
        </Card>

        <Card title={`3. Photos (up to ${MAX_PHOTOS})`}>
          <p className="mb-2 text-xs text-neutral-500">The first photo is the cover. Photos are resized automatically, so large camera photos are fine. Use JPG, PNG or WebP.</p>
          <div className="flex flex-wrap gap-3">
            {files.map((x, i) => (
              <div key={`${x.name}-${i}`} className="w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[i]} alt={x.name} className="h-24 w-24 rounded-xl border border-neutral-200 object-cover" />
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{i === 0 ? "Cover" : `#${i + 1}`}</span>
                  <button type="button" className="text-red-700" aria-label={`Remove photo ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          {files.length < MAX_PHOTOS && (
            <div className="mt-3"><input aria-label="Choose photos" type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} /></div>
          )}
        </Card>

        <Card title="4. Publish">
          {canPublish ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={f.publish} onChange={(e) => set("publish", e.target.checked)} />
              <span><strong>Show in the app now.</strong> Untick to save it as a draft and publish later.</span>
            </label>
          ) : <p className="text-sm text-neutral-600">You can save this phone as a draft. The owner publishes it.</p>}
        </Card>

        <div className="flex items-center gap-3">
          <Btn disabled={busy} onClick={save}>{busy ? "Saving…" : "Save phone"}</Btn>
          {step && <span className="text-sm text-neutral-600" role="status">{step}</span>}
        </div>
      </div>
    </>
  );
}

export default function NewPhonePage() {
  return <Guard perm="products.create"><Body /></Guard>;
}
