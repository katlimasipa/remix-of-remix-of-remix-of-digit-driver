import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

/** Update this to your real contact address — it is shown on all legal pages. */
export const CONTACT_EMAIL = "support@thdpstsmrttrdr.co.za";
export const LAST_UPDATED = "1 September 2026";

export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/70 px-4 py-3 backdrop-blur-xl pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" className="font-display text-sm font-semibold tracking-tight">
            ThDpstSmrtTrdr
          </Link>
          <nav className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Link to="/risk" className="transition-colors hover:text-primary">
              Risk
            </Link>
            <Link to="/terms" className="transition-colors hover:text-primary">
              Terms
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-primary">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>
        {intro && <p className="mt-5 text-sm leading-7 text-muted-foreground">{intro}</p>}
        <div className="mt-8 space-y-8">{children}</div>
      </main>

      <Footer />
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <h2 className="font-display text-base font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
