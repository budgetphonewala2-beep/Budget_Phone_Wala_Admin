import Link from "next/link";

// Public pages for customers (Google Play requires a public privacy policy and a web account-deletion page).
// They are plain server-rendered pages: no sign-in, no admin data.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <div className="text-xl font-bold text-[#D7263D]">BudgetPhonewala</div>
          <div className="text-sm text-neutral-500">Budget Aapka, Phone Hamara</div>
        </div>
        <nav aria-label="Legal" className="flex gap-4 text-sm font-medium">
          <Link href="/privacy" className="underline">Privacy</Link>
          <Link href="/terms" className="underline">Terms</Link>
          <Link href="/delete-account" className="underline">Delete account</Link>
        </nav>
      </header>
      <main className="space-y-4 text-[15px] leading-7 text-neutral-800 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
        {children}
      </main>
      <footer className="mt-12 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        BudgetPhonewala, Chowk, Bhadule Rd, Navi Peth, Chouphala, Pandharpur, Maharashtra 413304 · +91 98500 07981 · budgetphonewala2@gmail.com
      </footer>
    </div>
  );
}
