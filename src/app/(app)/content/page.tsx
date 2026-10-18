"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls } from "@/components/ui";
import { errText, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";

type Banner = { id?: string; title: string; subtitle: string; link: string; sort_order: string; active: boolean };
type Faq = { id?: string; q: string; a: string; sort_order: string };
const blankBanner: Banner = { title: "", subtitle: "", link: "", sort_order: "0", active: true };
const blankFaq: Faq = { q: "", a: "", sort_order: "0" };

async function load() {
  const db = supabaseBrowser();
  const [b, f] = await Promise.all([
    db.from("banners").select("*").order("sort_order"),
    db.from("faqs").select("*").order("sort_order"),
  ]);
  for (const r of [b, f]) if (r.error) throw r.error;
  return { banners: (b.data ?? []) as Row[], faqs: (f.data ?? []) as Row[] };
}

function Body() {
  const perms = usePerms();
  const canEdit = perms.has("settings.manage");
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [faq, setFaq] = useState<Faq | null>(null);

  async function run(fn: () => Promise<{ error: unknown }>, ok: string) {
    setMsg(null);
    const r = await fn();
    if (r.error) setMsg({ kind: "error", text: errText(r.error) });
    else { setMsg({ kind: "ok", text: `${ok} Both the Android and iOS apps show it on next open.` }); await reload(); }
  }

  async function saveBanner() {
    if (!banner) return;
    if (banner.title.trim().length < 3) return setMsg({ kind: "error", text: "Banner title is required." });
    const row = { title: banner.title.trim(), subtitle: banner.subtitle.trim(), link: banner.link.trim() || null, sort_order: Number(banner.sort_order) || 0, active: banner.active };
    const db = supabaseBrowser();
    await run(async () => (banner.id ? db.from("banners").update(row).eq("id", banner.id) : db.from("banners").insert(row)), "Banner saved.");
    setBanner(null);
  }

  async function saveFaq() {
    if (!faq) return;
    if (faq.q.trim().length < 3 || faq.a.trim().length < 3) return setMsg({ kind: "error", text: "Question and answer are required." });
    const row = { q: faq.q.trim(), a: faq.a.trim(), sort_order: Number(faq.sort_order) || 0 };
    const db = supabaseBrowser();
    await run(async () => (faq.id ? db.from("faqs").update(row).eq("id", faq.id) : db.from("faqs").insert(row)), "FAQ saved.");
    setFaq(null);
  }

  return (
    <>
      <PageHeader title="Home banners & FAQs" subtitle="What customers see on the app home screen and in Help. One edit updates the Android and iOS apps." />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-5">
          <Card title="Home banners">
            {canEdit && <div className="mb-3"><Btn onClick={() => setBanner(blankBanner)}>Add banner</Btn></div>}
            {data.banners.length === 0 ? <Empty>No banners. The app hides the banner area.</Empty> : (
              <Table head={["Order", "Title", "Subtitle", "Status", ""]}>
                {data.banners.map((b) => (
                  <tr key={String(b.id)}>
                    <Td>{String(b.sort_order)}</Td><Td className="font-semibold">{String(b.title)}</Td><Td className="max-w-sm">{String(b.subtitle ?? "")}</Td>
                    <Td>{b.active ? <Badge tone="green">Showing</Badge> : <Badge>Hidden</Badge>}</Td>
                    <Td>{canEdit && (
                      <div className="flex gap-1.5">
                        <Btn kind="ghost" onClick={() => setBanner({ id: String(b.id), title: String(b.title), subtitle: String(b.subtitle ?? ""), link: String(b.link ?? ""), sort_order: String(b.sort_order ?? 0), active: Boolean(b.active) })}>Edit</Btn>
                        <Btn kind="danger" onClick={() => { if (window.confirm("Delete this banner?")) void run(async () => supabaseBrowser().from("banners").delete().eq("id", b.id), "Banner deleted."); }}>Delete</Btn>
                      </div>)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Help & FAQs">
            {canEdit && <div className="mb-3"><Btn onClick={() => setFaq(blankFaq)}>Add FAQ</Btn></div>}
            {data.faqs.length === 0 ? <Empty>No FAQs yet.</Empty> : (
              <Table head={["Order", "Question", "Answer", ""]}>
                {data.faqs.map((f) => (
                  <tr key={String(f.id)}>
                    <Td>{String(f.sort_order)}</Td><Td className="font-semibold">{String(f.q)}</Td><Td className="max-w-md">{String(f.a)}</Td>
                    <Td>{canEdit && (
                      <div className="flex gap-1.5">
                        <Btn kind="ghost" onClick={() => setFaq({ id: String(f.id), q: String(f.q), a: String(f.a), sort_order: String(f.sort_order ?? 0) })}>Edit</Btn>
                        <Btn kind="danger" onClick={() => { if (window.confirm("Delete this FAQ?")) void run(async () => supabaseBrowser().from("faqs").delete().eq("id", f.id), "FAQ deleted."); }}>Delete</Btn>
                      </div>)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {banner && (
        <Modal title={banner.id ? "Edit banner" : "New banner"} onClose={() => setBanner(null)}>
          <div className="space-y-3">
            <Field label="Title" hint="Keep it short: it is shown large"><input className={inputCls} maxLength={60} value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })} /></Field>
            <Field label="Subtitle"><textarea className={inputCls} rows={2} maxLength={120} value={banner.subtitle} onChange={(e) => setBanner({ ...banner, subtitle: e.target.value })} /></Field>
            <Field label="Link (optional)"><input className={inputCls} value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} /></Field>
            <Field label="Display order (smallest first)"><input className={inputCls} inputMode="numeric" value={banner.sort_order} onChange={(e) => setBanner({ ...banner, sort_order: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={banner.active} onChange={(e) => setBanner({ ...banner, active: e.target.checked })} />Show in the app</label>
            <div className="flex gap-2"><Btn onClick={saveBanner}>Save banner</Btn><Btn kind="ghost" onClick={() => setBanner(null)}>Cancel</Btn></div>
          </div>
        </Modal>
      )}
      {faq && (
        <Modal title={faq.id ? "Edit FAQ" : "New FAQ"} onClose={() => setFaq(null)}>
          <div className="space-y-3">
            <Field label="Question"><input className={inputCls} value={faq.q} onChange={(e) => setFaq({ ...faq, q: e.target.value })} /></Field>
            <Field label="Answer"><textarea className={inputCls} rows={4} value={faq.a} onChange={(e) => setFaq({ ...faq, a: e.target.value })} /></Field>
            <Field label="Display order"><input className={inputCls} inputMode="numeric" value={faq.sort_order} onChange={(e) => setFaq({ ...faq, sort_order: e.target.value })} /></Field>
            <div className="flex gap-2"><Btn onClick={saveFaq}>Save FAQ</Btn><Btn kind="ghost" onClick={() => setFaq(null)}>Cancel</Btn></div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function ContentPage() {
  return <Guard perm="settings.manage"><Body /></Guard>;
}
