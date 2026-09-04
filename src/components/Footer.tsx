import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const SUPPORT_EMAIL = "support@thdpstsmrttrdr.co.za";

const PRODUCT_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Strategies", href: "/#strategies" },
  { label: "Funding", href: "/#funding" },
  { label: "Open app", href: "/dashboard" },
];

const LEGAL_LINKS = [
  { label: "Risk disclaimer", to: "/risk" },
  { label: "Terms and conditions", to: "/terms" },
  { label: "Privacy policy", to: "/privacy" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface/40 pb-safe">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div>
            <Link to="/" className="font-display text-base font-semibold tracking-tight">
              ThDpstSmrtTrdr
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              Deriv trading automation software for last-digit repetition patterns. You set the rules,
              stake and limits. Deriv holds your funds and executes the contracts.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Software only. Not financial advice. 18+.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Product</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-foreground/80 transition-colors hover:text-primary">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Legal</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {LEGAL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-foreground/80 transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Support</h3>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Questions about the app, your profile or your data? Email us and we will get back to you.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Risk line */}
        <div className="mt-10 rounded-xl border border-bear/30 bg-bear/5 px-4 py-3 text-xs leading-5 text-bear">
          <span className="font-semibold">Risk warning.</span> Trading is high risk and you can lose all of
          your money. Past performance does not guarantee future results. This app is software only and
          is not financial, investment or tax advice. Test on a demo account first.
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
          <p>
            {year} ThDpstSmrtTrdr. All rights reserved. Not affiliated with or endorsed by Deriv.
          </p>
          <p>
            Built by{" "}
            <a
              href="https://architeq.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              Architeq Web Agency
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
