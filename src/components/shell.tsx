"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadPerms, type Perms } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Loading, Notice } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const PermCtx = createContext<Perms>({ isOwner: false, list: [], has: () => false });
export const usePerms = () => useContext(PermCtx);

type NavItem = { href: string; label: string; perm: string; icon: IconName };
const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ href: "/", label: "Dashboard", perm: "reports.view", icon: "dashboard" }] },
  {
    title: "Sales",
    items: [
      { href: "/orders", label: "Orders", perm: "orders.read", icon: "orders" },
      { href: "/payments", label: "Payments & refunds", perm: "payments.read", icon: "payments" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/products", label: "Products & units", perm: "products.read", icon: "products" },
      { href: "/inventory", label: "Inventory", perm: "inventory.read", icon: "inventory" },
      { href: "/import-export", label: "Import / export", perm: "products.import|products.export", icon: "import" },
    ],
  },
  {
    title: "Customers",
    items: [
      { href: "/customers", label: "Customers", perm: "customers.read", icon: "customers" },
      { href: "/support", label: "Warranty, returns, enquiries", perm: "returns.manage|warranty.manage|enquiries.manage", icon: "support" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/marketing", label: "Coupons & campaigns", perm: "coupons.manage|marketing.send|notifications.send", icon: "marketing" },
      { href: "/content", label: "Banners & FAQs", perm: "settings.manage", icon: "content" },
    ],
  },
  {
    title: "Store",
    items: [
      { href: "/delivery", label: "Delivery & COD", perm: "delivery.configure", icon: "delivery" },
      { href: "/settings", label: "Store & policies", perm: "settings.manage|policies.manage", icon: "settings" },
      { href: "/staff", label: "Staff & roles", perm: "staff.read|staff.manage", icon: "staff" },
      { href: "/errors", label: "App health", perm: "audit.view", icon: "alert" },
    ],
  },
];

const anyOf = (perms: Perms, spec: string) => spec.split("|").some((p) => perms.has(p));

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
        <p className="mt-2 text-sm text-neutral-600">This account is not an active staff member. Ask the store owner for access.</p>
        <button onClick={signOut} className="mt-4 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50">Sign out</button>
      </div>
    );
  }

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => anyOf(perms, n.perm)) })).filter((g) => g.items.length > 0);
  const current = groups.flatMap((g) => g.items).find((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href)));
  const initial = (email[0] ?? "A").toUpperCase();

  const nav = (
    <nav className="flex flex-col gap-4 px-3 pb-4" aria-label="Main">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g.title}</div>
          <div className="flex flex-col gap-0.5">
            {g.items.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-[#D7263D] text-white shadow-sm" : "text-neutral-700 hover:bg-neutral-100"}`}>
                  <Icon name={n.icon} />
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <PermCtx.Provider value={perms}>
      <div className="min-h-screen lg:flex">
        {/* desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="px-5 py-5">
            <div className="text-lg font-bold text-[#D7263D]">BudgetPhonewala</div>
            <div className="text-xs font-medium text-neutral-500">Admin console</div>
          </div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          <div className="flex items-center gap-3 border-t border-neutral-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D7263D] text-sm font-bold text-white" aria-hidden="true">{initial}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{perms.isOwner ? "Owner" : "Staff"}</div>
              <div className="truncate text-xs text-neutral-500">{email.endsWith("@admin.invalid") ? "Admin ID sign-in" : email}</div>
            </div>
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[#D7263D]"><Icon name="logout" /></button>
          </div>
          <Link href="/account" className="border-t border-neutral-100 px-5 py-2 text-xs font-semibold text-neutral-500 hover:text-[#D7263D]">Change password</Link>
        </aside>

        <div className="min-w-0 flex-1">
          {/* mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-lg border border-neutral-300 p-2"><Icon name="menu" /></button>
              <span className="font-bold text-[#D7263D]">{current?.label ?? "Admin"}</span>
            </div>
            <button onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 text-neutral-500"><Icon name="logout" /></button>
          </header>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
              <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-white pt-4 shadow-xl">
                <div className="px-5 pb-3 text-lg font-bold text-[#D7263D]">BudgetPhonewala</div>
                {nav}
                <Link href="/account" onClick={() => setOpen(false)} className="mx-3 mb-4 block rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">Change password</Link>
              </div>
            </div>
          )}
          <main className="mx-auto w-full max-w-7xl p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </PermCtx.Provider>
  );
}

/** Wrap a page body: shows a clear message instead of failing queries when the permission is missing. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const p = usePerms();
  if (!anyOf(p, perm)) return <Notice>You do not have permission to view this page ({perm}).</Notice>;
  return <>{children}</>;
}
