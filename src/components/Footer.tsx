import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-5 text-center text-[11px] text-muted-foreground pb-safe">
      <p className="mx-auto max-w-2xl leading-6">
        Trading is high risk. You can lose all of your money. Past performance does not guarantee
        future results. This app is software only and is not financial advice. 18+.
      </p>
      <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-widest">
        <Link to="/" className="transition-colors hover:text-primary">
          About
        </Link>
        <Link to="/risk" className="transition-colors hover:text-primary">
          Risk disclaimer
        </Link>
        <Link to="/terms" className="transition-colors hover:text-primary">
          Terms
        </Link>
        <Link to="/privacy" className="transition-colors hover:text-primary">
          Privacy
        </Link>
      </nav>
      <p className="mt-3">
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
    </footer>
  );
}
