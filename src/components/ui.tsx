"use client";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

const tones = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-neutral-100 text-neutral-700",
} as const;
type Tone = keyof typeof tones;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function statusTone(s: string | null | undefined): Tone {
  switch (s) {
    case "delivered": case "picked_up": case "captured": case "cod_collected": case "available": case "processed":
    case "approved": case "resolved": case "published": case "reconciled": case "accepted": case "completed":
      return "green";
    case "cancelled": case "failed": case "delivery_failed": case "rejected": case "refunded": case "archived": case "closed":
      return "red";
    case "pending_payment": case "placed": case "pending": case "reserved": case "draft": case "open": case "collected": case "new":
      return "amber";
    default:
      return "blue";
  }
}

export function Btn({ children, onClick, kind = "primary", disabled, type = "button", title }: {
  children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; type?: "button" | "submit"; title?: string;
}) {
  const k =
    kind === "primary" ? "bg-[#D7263D] text-white hover:bg-[#b81f33]"
    : kind === "danger" ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : "border border-neutral-300 bg-white hover:bg-neutral-50";
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${k}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
export const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#D7263D] focus:ring-2 focus:ring-[#D7263D]/20";

export function Notice({ kind = "error", children }: { kind?: "error" | "ok" | "info"; children: ReactNode }) {
  const c =
    kind === "error" ? "border-red-200 bg-red-50 text-red-800"
    : kind === "ok" ? "border-green-200 bg-green-50 text-green-800"
    : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`mb-3 rounded-xl border px-3 py-2 text-sm ${c}`}>
      {children}
    </div>
  );
}

export function Loading() {
  return <div className="p-6 text-sm text-neutral-500">Loading…</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">{children}</div>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
);

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
