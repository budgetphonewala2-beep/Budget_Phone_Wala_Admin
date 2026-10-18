"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadPerms, type Perms } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Loading, Notice } from "@/components/ui";

const PermCtx = createContext<Perms>({ isOwner: false, list: [], has: () => false });
export const usePerms = () => useContext(PermCtx);

const NAV: { href: string; label: string; perm: string }[] = [
  { href: "/", label: "Dashboard", perm: "reports.view" },
  { href: "/products", label: "Products & units", perm: "products.read" },
  { href: "/inventory", label: "Inventory", perm: "inventory.read" },
  { href: "/orders", label: "Orders", perm: "orders.read" },
  { href: "/payments", label: "Payments & refunds", perm: "payments.read" },
  { href: "/customers", label: "Customers", perm: "customers.read" },
  { href: "/support", label: "Warranty, returns, enquiries", perm: "returns.manage|warranty.manage|enquiries.manage" },
  { href: "/marketing", label: "Coupons & campaigns", perm: "coupons.manage|marketing.send|notifications.send" },
  { href: "/delivery", label: "Delivery & COD", perm: "delivery.configure" },
  { href: "/settings", label: "Store & policies", perm: "settings.manage|policies.manage" },
  { href: "/content", label: "Banners & FAQs", perm: "settings.manage" },
  { href: "/staff", label: "Staff & roles", perm: "staff.read" },
  { href: "/import-export", label: "Import / export", perm: "products.import|products.export" },
  { href: "/audit", label: "Audit log", perm: "audit.view" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [perms, setPerms] = useState<Perms | null>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = supabaseBrowser();
        const { data } = await db.auth.getUser();
        if (!data.user) return router.replace("/login");
        setEmail(data.user.email ?? "");
        setPerms(await loadPerms());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load your permissions");
      }
    })();
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (err) return <div className="p-6"><Notice>{err}</Notice></div>;
  if (!perms) return <Loading />;

  // not a staff member (a customer signed in here): no access at all
  if (perms.list.length === 0) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold">No admin access</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {email} is not an active staff member. Ask the store owner to invite you, then open the invitation link.
        </p>
        <button onClick={signOut} className="mt-4 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50">Sign out</button>
      </div>
    );
  }

  const items = NAV.filter((n) => n.perm.split("|").some((p) => perms.has(p)));
  return (
    <PermCtx.Provider value={perms}>
      <div className="min-h-screen lg:flex">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
          <span className="font-bold text-[#D7263D]">BudgetPhonewala Admin</span>
          <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Menu</button>
        </header>
        <aside className={`${open ? "block" : "hidden"} w-full shrink-0 border-r border-neutral-200 bg-white lg:block lg:w-64`}>
          <div className="hidden px-5 py-5 text-lg font-bold text-[#D7263D] lg:block">BudgetPhonewala<span className="block text-xs font-medium text-neutral-500">Admin console</span></div>
          <nav className="flex flex-col gap-0.5 p-2" aria-label="Main">
            {items.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${active ? "bg-[#D7263D] text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-neutral-200 p-4 text-xs text-neutral-500">
            <div className="truncate">{email}</div>
            <div>{perms.isOwner ? "Owner" : "Staff"}</div>
            <button onClick={signOut} className="mt-2 font-semibold text-[#D7263D]">Sign out</button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </PermCtx.Provider>
  );
}

/** Wrap a page body: shows a clear message instead of failing queries when the permission is missing. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const p = usePerms();
  if (!perm.split("|").some((x) => p.has(x))) return <Notice>You do not have permission to view this page ({perm}).</Notice>;
  return <>{children}</>;
}
