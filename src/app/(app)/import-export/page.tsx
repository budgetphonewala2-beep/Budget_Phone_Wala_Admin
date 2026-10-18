"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Notice, PageHeader, Table, Td } from "@/components/ui";
import { errText, rpc, type Row } from "@/lib/data";
import { download, parseCsv, toCsv } from "@/lib/csv";

type ImportResult = { dry_run: boolean; ok_rows: number; invalid_rows: number; results: { row: number; ok: boolean; errors: string[] | null }[] };

const TEMPLATE = [{
  brand: "Apple", model: "iPhone 12", network: "5G", storage_gb: "128", ram_gb: "4", color: "Blue", condition_grade: "A", battery_health_pct: "89",
  selling_price: "27499", mrp: "59900", acquisition_cost: "", imei: "", serial_number: "", has_bill: "yes",
}];

function Body() {
  const perms = usePerms();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [publish, setPublish] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    setResult(null);
    setMsg(null);
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setMsg({ kind: "error", text: "File is larger than 2 MB. Split it into smaller files." });
    const parsed = parseCsv(await f.text());
    if (parsed.length === 0) return setMsg({ kind: "error", text: "No rows found. Check the header row matches the template." });
    if (parsed.length > 500) return setMsg({ kind: "error", text: "Maximum 500 rows per import." });
    setFileName(f.name);
    setRows(parsed);
  }

  async function run(dry: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await rpc<ImportResult>("admin_import_units", { p_rows: rows, p_dry_run: dry, p_publish: publish && !dry });
      setResult(r);
      if (dry) setMsg({ kind: r.invalid_rows ? "error" : "ok", text: r.invalid_rows ? `${r.invalid_rows} row(s) have errors. Fix them and re-upload. Nothing was saved.` : `All ${r.ok_rows} rows are valid. Nothing is saved yet.` });
      else setMsg({ kind: "ok", text: `Imported ${r.ok_rows} units${publish ? " and published them" : " as drafts"}.` });
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function exportUnits() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await rpc<Row[]>("admin_export_units");
      download(`units-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
      setMsg({ kind: "ok", text: "Export downloaded. The export is recorded in the audit log. IMEIs are masked." });
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Import / export" subtitle="Imports always start as a dry run: nothing is saved until every row passes. Exports escape spreadsheet formulas." />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        {perms.has("products.import") && (
          <Card title="Import units from CSV">
            <p className="mb-3 text-sm text-neutral-600">Required columns: brand, model, storage_gb, color, condition_grade (A+, A, B, C), selling_price. Prices are in rupees. Duplicate IMEIs are rejected.</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <Btn kind="ghost" onClick={() => download("units-template.csv", toCsv(TEMPLATE))}>Download template</Btn>
              <input aria-label="Choose CSV file" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
            </div>
            {rows.length > 0 && (
              <>
                <p className="mb-2 text-sm">{fileName}: {rows.length} rows</p>
                <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={publish} disabled={!perms.has("products.publish")} onChange={(e) => setPublish(e.target.checked)} />Publish to the shop after import (needs publish permission; otherwise drafts)</label>
                <div className="flex gap-2">
                  <Btn disabled={busy} onClick={() => run(true)}>1. Check (dry run)</Btn>
                  <Btn disabled={busy || !result || result.invalid_rows > 0 || !result.dry_run} onClick={() => run(false)}>2. Import</Btn>
                </div>
              </>
            )}
          </Card>
        )}
        {perms.has("products.export") && (
          <Card title="Export units">
            <p className="mb-3 text-sm text-neutral-600">All units with status and masked IMEI. Acquisition cost appears only if you have the cost permission.</p>
            <Btn disabled={busy} onClick={exportUnits}>Download CSV</Btn>
          </Card>
        )}
      </div>

      {result && result.results.some((r) => !r.ok) && (
        <div className="mt-5">
          <Table head={["Row", "Result", "Problems"]}>
            {result.results.filter((r) => !r.ok).map((r) => (
              <tr key={r.row}><Td>{r.row}</Td><Td><Badge tone="red">Invalid</Badge></Td><Td>{(r.errors ?? []).join("; ")}</Td></tr>
            ))}
          </Table>
        </div>
      )}
    </>
  );
}

export default function ImportExportPage() {
  return <Guard perm="products.import|products.export"><Body /></Guard>;
}
