import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Bell, Radio, Shield, History, ToggleLeft, Layers } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Reveal, TiltCard } from "@/components/landing/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/* Content (all statements describe real app behaviour)               */
/* ------------------------------------------------------------------ */

const STEPS = [
  ["Create a profile", "Sign up with an email and password. The profile links your devices so alerts reach all of them."],
  ["Connect your Deriv account", "Authorise with Deriv or paste an API token. Demo and real accounts are kept separate, each with its own token."],
  ["Pick a strategy", "Choose an entry rule and set the repetition count. Optionally wait for a failed cycle before entering."],
  ["Set your risk limits", "Set stake, stop loss and take profit. The bot stops itself when either limit is reached."],
  ["Start the bot", "It streams live ticks from Deriv, watches the last digit and places a Digits Differ contract when your pattern appears."],
  ["Track results", "Watch the tick stream, trade log and running P/L. Push alerts tell you when it starts, stops, wins or loses."],
  ["Save the session", "End and save a run to keep it in your history, stored separately for demo and real accounts."],
] as const;

type StrategyKey = "specific" | "any" | "xxxyyy" | "odd" | "even" | "thdpst";

const STRATEGIES: { key: StrategyKey; name: string; desc: string; digits: string; hi: number[]; barrier?: string }[] = [
  {
    key: "specific",
    name: "Specific digit",
    desc: "Waits for one digit you choose to repeat a set number of times in a row before entering.",
    digits: "3 8 1 7 7 7 7",
    hi: [3, 4, 5, 6],
    barrier: "7",
  },
  {
    key: "any",
    name: "Any digit",
    desc: "Waits for any digit to repeat your chosen number of times in a row.",
    digits: "9 2 4 4 4 0 6",
    hi: [2, 3, 4],
    barrier: "4",
  },
  {
    key: "xxxyyy",
    name: "XXXYYY = Z",
    desc: "Three matching digits followed by three matching digits of a different value. The first digit becomes the barrier.",
    digits: "2 2 2 5 5 5",
    hi: [0, 1, 2, 3, 4, 5],
    barrier: "2",
  },
  {
    key: "odd",
    name: "Odd reps",
    desc: "Only counts repetition streaks made of odd digits.",
    digits: "6 3 3 3 8 1 0",
    hi: [1, 2, 3],
    barrier: "3",
  },
  {
    key: "even",
    name: "Even reps",
    desc: "Only counts repetition streaks made of even digits.",
    digits: "5 8 8 8 8 1 9",
    hi: [1, 2, 3, 4],
    barrier: "8",
  },
  {
    key: "thdpst",
    name: "TH DPST Strtgy",
    desc: "Cycles through the strategies you tick, moving to the next one after each trade settles.",
    digits: "1 1 1 4 4 4 9",
    hi: [0, 1, 2, 3, 4, 5],
    barrier: "1",
  },
];

/* ------------------------------------------------------------------ */

import { useEffect } from 'react';

function LandingPage() {
  useEffect(() => {
    const paramsStr = window.location.search || window.location.hash;
    if (paramsStr.includes('code=') || paramsStr.includes('acct1=')) {
      window.location.href = '/dashboard' + paramsStr;
    }
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Nav />
      <main>
        <Hero />
        <RiskBand />
        <Features />
        <HowItWorks />
        <Strategies />
        <Statement />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}

/* ---------------------------------- Nav --------------------------------- */

function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full pt-safe">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl border border-border bg-background/75 px-4 py-2.5 shadow-sm backdrop-blur-xl sm:mx-6 lg:mx-auto">
        <Link to="/" className="flex items-center">
          <img src="/logo-light.png" alt="ThDpstSmrtTrdr" className="h-9 w-auto dark:hidden" />
          <img src="/logo-dark.png" alt="ThDpstSmrtTrdr" className="hidden h-9 w-auto dark:block" />
        </Link>
        <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#strategies" className="transition-colors hover:text-foreground">Strategies</a>
          <Link to="/risk" className="transition-colors hover:text-foreground">Risk</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="sm" className="rounded-full px-4">
              Open app
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* --------------------------------- Hero --------------------------------- */

function Hero() {
  return (
    <section className="hero-wash relative overflow-hidden pt-32 pb-8 sm:pt-40">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Deriv trading automation software
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
              Last-digit pattern trading,
              <br />
              run by your rules.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              ThDpstSmrtTrdr connects to your own Deriv account, watches the last digit of live
              ticks and places Digits Differ contracts when the repetition pattern you set appears.
              You choose the strategy, the stake and the limits.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/dashboard">
                <Button size="lg" className="group h-12 rounded-full px-7 text-sm">
                  Open the app
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline" className="h-12 rounded-full bg-card px-7 text-sm">
                  See how it works
                </Button>
              </a>
            </div>
          </Reveal>
        </div>

        {/* Product mockup */}
        <Reveal variant="scale" delay={320} className="relative mx-auto mt-16 max-w-4xl">
          <FloatingCard className="parallax-down float-slow -left-2 top-6 hidden sm:block lg:-left-16" tilt="-6deg">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Streak detected</p>
            <div className="mt-2 flex items-end gap-1.5">
              {[7, 7, 7, 7].map((d, i) => (
                <span key={i} className="grid h-8 w-7 place-items-center rounded-md bg-primary/15 font-mono text-sm font-semibold text-primary">
                  {d}
                </span>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">4 of 4 reps</p>
          </FloatingCard>

          <FloatingCard className="parallax-up float-slower -right-2 -top-4 hidden sm:block lg:-right-16" tilt="5deg">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Bell className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-semibold">Bot started</p>
                <p className="text-[10px] text-muted-foreground">Sent to 3 devices</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="parallax-up float-slow -bottom-6 right-6 hidden md:block lg:right-0" tilt="3deg">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Contract</p>
            <p className="mt-1 font-mono text-xs">Digits Differ from 7</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">1HZ100V</p>
          </FloatingCard>

          <TiltCard max={3}>
            <div className="card-shadow rounded-2xl border border-border bg-card/80 p-2 backdrop-blur">
              <div className="rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="status-dot h-1.5 w-1.5 rounded-full bg-bull text-bull" />
                    Running
                    <span className="hidden text-border sm:inline">|</span>
                    <span className="hidden sm:inline">Demo</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px]">Any digit</span>
                    <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px]">Reps 4</span>
                  </div>
                </div>
                <div className="grid gap-px bg-border sm:grid-cols-[1.1fr_1fr_1fr_1fr]">
                  <Stat label="Session P/L" value="+4.75" tone="bull" wide />
                  <Stat label="Wins" value="5" />
                  <Stat label="Losses" value="1" />
                  <Stat label="Trades" value="6" />
                </div>
                <div className="grid gap-0 border-t border-border md:grid-cols-[auto_1fr]">
                  <div className="flex items-center justify-center border-b border-border px-8 py-6 md:border-b-0 md:border-r">
                    <span className="digit-glow font-mono text-7xl font-semibold text-primary">7</span>
                  </div>
                  <div className="px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tick stream</p>
                    <DigitRow digits="5 0 3 3 9 1 1 1 4 8 2 6 6 7 7 7 7" hi={[3, 4, 6, 7, 8, 12, 13, 14, 15, 16, 17]} />
                    <div className="mt-4 space-y-1.5">
                      {[
                        ["Differ 7", "+0.95", "bull"],
                        ["Differ 1", "+0.95", "bull"],
                        ["Differ 3", "-1.00", "bear"],
                      ].map(([a, b, tone], i) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-surface px-3 py-1.5 font-mono text-[11px]">
                          <span>{a}</span>
                          <span className={tone === "bull" ? "text-bull" : "text-bear"}>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Illustrative screen. Not live data or a promise of results.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function FloatingCard({ children, className, tilt }: { children: React.ReactNode; className?: string; tilt: string }) {
  return (
    <div
      className={cn("absolute z-10 rounded-xl border border-border bg-card p-3 shadow-lg", className)}
      style={{ "--tilt": tilt } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, tone, wide }: { label: string; value: string; tone?: "bull" | "bear"; wide?: boolean }) {
  return (
    <div className={cn("bg-background px-4 py-3", wide && "sm:px-5")}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-semibold", tone === "bull" && "text-bull", tone === "bear" && "text-bear")}>
        {value}
      </p>
    </div>
  );
}

const STREAK_TONES = ["bg-primary/15 text-primary", "bg-warn/20 text-warn", "bg-bull/15 text-bull"];

function DigitRow({ digits, hi }: { digits: string; hi: number[] }) {
  const arr = digits.split(" ");
  let group = -1;
  let prevHi = false;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {arr.map((d, i) => {
        const isHi = hi.includes(i);
        if (isHi && (!prevHi || arr[i - 1] !== d)) group += 1;
        prevHi = isHi;
        return (
          <span
            key={i}
            className={cn(
              "grid h-7 w-6 place-items-center rounded-md font-mono text-xs transition-transform hover:-translate-y-0.5",
              isHi ? STREAK_TONES[group % STREAK_TONES.length] : "bg-surface text-muted-foreground",
            )}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------ Risk band ------------------------------ */

function RiskBand() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-8">
      <Reveal>
        <div className="rounded-2xl border border-bear/30 bg-bear/8 px-5 py-4 text-sm leading-6 text-bear">
          <span className="font-semibold">Risk warning.</span> Trading is high risk and you can lose
          all of your money. Past performance does not guarantee future results. This app is
          software only and is not financial advice. Test on a demo account first. 18+.
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------- Features ------------------------------ */

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-xs font-medium text-primary">What the app does</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
            One screen for the tick stream, the trades and the limits
          </h2>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-6">
        <FeatureCard
          className="md:col-span-4"
          delay={0}
          icon={<Radio className="h-4 w-4" />}
          title="Live tick stream"
          desc="Connects to Deriv over WebSocket and shows each incoming tick and its last digit, with repetition streaks colour-coded so you can see what the bot sees."
        >
          <div className="marquee overflow-hidden rounded-xl border border-border bg-background p-3">
            <div className="marquee-track flex w-max gap-1.5">
              {Array.from({ length: 2 }).map((_, k) => (
                <DigitRow
                  key={k}
                  digits="8 8 3 1 1 1 1 0 5 5 9 2 7 7 7 4 6 6 6 6 3 0 9 9 1"
                  hi={[0, 1, 3, 4, 5, 6, 8, 9, 12, 13, 14, 16, 17, 18, 19, 22, 23]}
                />
              ))}
            </div>
          </div>
        </FeatureCard>

        <FeatureCard
          className="md:col-span-2"
          delay={80}
          icon={<ToggleLeft className="h-4 w-4" />}
          title="Demo or real"
          desc="Each account keeps its own saved credentials and its own session history."
        >
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1 font-mono text-[11px]">
            <span className="rounded-lg bg-primary py-2 text-center text-primary-foreground">Demo</span>
            <span className="py-2 text-center text-muted-foreground">Real</span>
          </div>
        </FeatureCard>

        <FeatureCard
          className="md:col-span-2"
          delay={0}
          icon={<Shield className="h-4 w-4" />}
          title="Stop loss and take profit"
          desc="You set both. The bot stops itself and notifies you when either is reached."
        >
          <div className="space-y-2 rounded-xl border border-border bg-background p-3 font-mono text-[11px]">
            <Bar label="Take profit" pct={64} tone="bull" />
            <Bar label="Stop loss" pct={22} tone="bear" />
          </div>
        </FeatureCard>

        <FeatureCard
          className="md:col-span-2"
          delay={80}
          icon={<Layers className="h-4 w-4" />}
          title="Digits Differ contracts"
          desc="When your pattern triggers, the bot buys a Digits Differ contract on your symbol at your stake."
        >
          <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3 font-mono text-[11px]">
            <span>1HZ100V</span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">Differ from 4</span>
            <span>0.35</span>
          </div>
        </FeatureCard>

        <FeatureCard
          className="md:col-span-2"
          delay={160}
          icon={<Bell className="h-4 w-4" />}
          title="Cross-device alerts"
          desc="Optional web push reaches every device signed in to your profile, even in the background."
        >
          <div className="space-y-1.5">
            {["Bot started", "Trade won +0.95", "Take profit reached"].map((t, i) => (
              <div key={t} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px]" style={{ opacity: 1 - i * 0.25 }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t}
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard
          className="md:col-span-6"
          delay={0}
          icon={<History className="h-4 w-4" />}
          title="Session history"
          desc="Every saved run stores profit and loss, wins, losses, trade count, repetitions waited for and the settings used. Demo and real are kept apart."
          horizontal
        >
          <div className="grid gap-1.5 font-mono text-[11px] sm:grid-cols-3">
            {[
              ["Any digit", "Reps 4", "+3.80", "bull"],
              ["XXXYYY = Z", "Wait fail", "-2.00", "bear"],
              ["TH DPST", "3 modes", "+1.15", "bull"],
            ].map(([a, b, c, tone]) => (
              <div key={a} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="truncate">{a}</span>
                <span className="ml-auto whitespace-nowrap text-muted-foreground">{b}</span>
                <span className={cn("whitespace-nowrap", tone === "bull" ? "text-bull" : "text-bear")}>{c}</span>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Example values for illustration only.
      </p>
    </section>
  );
}

function FeatureCard({
  icon, title, desc, children, className, delay, horizontal,
}: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode; className?: string; delay: number; horizontal?: boolean;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <div className={cn("lift sheen group h-full rounded-2xl border border-border bg-surface/60 p-5", horizontal && "md:grid md:grid-cols-[1fr_1.4fr] md:items-center md:gap-8")}>
        <div>
          <span className="inline-grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-primary">
            {icon}
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{desc}</p>
        </div>
        <div className={cn("mt-5 transition-transform duration-500 group-hover:-translate-y-1", horizontal && "md:mt-0")}>{children}</div>
      </div>
    </Reveal>
  );
}

function Bar({ label, pct, tone }: { label: string; pct: number; tone: "bull" | "bear" }) {
  return (
    <div>
      <div className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", tone === "bull" ? "bg-bull" : "bg-bear")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ----------------------------- How it works ---------------------------- */

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-y border-border bg-surface/40 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="text-xs font-medium text-primary">How it works</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Seven steps from sign up to a saved session
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              The bot never touches your funds. Deriv holds your money and executes the contracts.
              You can stop the bot at any time.
            </p>
          </Reveal>
        </div>
        <ol className="space-y-3">
          {STEPS.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 60}>
              <div className="lift group flex gap-5 rounded-2xl border border-border bg-card p-5">
                <span className="font-mono text-sm text-primary tabular-nums">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">{t}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------ Strategies ----------------------------- */

function Strategies() {
  const [active, setActive] = useState<StrategyKey>("any");
  const s = STRATEGIES.find((x) => x.key === active)!;

  return (
    <section id="strategies" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-xs font-medium text-primary">Entry strategies</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Rules for when to enter, nothing more
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Each strategy is only a rule for when to place a trade. None of them predicts the market
            and none of them changes the odds of the underlying contract.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <ul className="divide-y divide-border border-y border-border">
            {STRATEGIES.map((x) => {
              const on = x.key === active;
              return (
                <li key={x.key}>
                  <button
                    onMouseEnter={() => setActive(x.key)}
                    onClick={() => setActive(x.key)}
                    className={cn(
                      "flex w-full items-center gap-3 py-4 text-left transition-colors",
                      on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ArrowRight className={cn("h-4 w-4 shrink-0 text-primary transition-all duration-300", on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")} />
                    <span className="font-display text-base font-medium">{x.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal variant="scale" delay={120}>
          <TiltCard max={5}>
            <div key={s.key} className="card-shadow animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-6 duration-500">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                  {s.name}
                </span>
                {s.barrier && (
                  <span className="font-mono text-[11px] text-muted-foreground">Barrier {s.barrier}</span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {s.digits.split(" ").map((d, i) => {
                  const hi = s.hi.includes(i);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "grid h-14 w-12 place-items-center rounded-xl border font-mono text-2xl font-semibold transition-all",
                        hi ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-surface text-muted-foreground",
                      )}
                      style={{ transitionDelay: `${i * 40}ms` }}
                    >
                      {d}
                    </span>
                  );
                })}
              </div>
              <p className="mt-6 text-sm leading-6 text-muted-foreground">{s.desc}</p>
              <div className="mt-5 rounded-xl border border-border bg-surface/60 p-4 text-xs leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Wait for a failed cycle.</span> Any
                strategy can skip the first matching pattern and only enter once the streak has run
                one step past your target, for example 5 reps when you set 4.
              </div>
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------- Statement ----------------------------- */

function Statement() {
  return (
    <section className="border-y border-border bg-surface/40 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <p className="max-w-2xl font-display text-2xl font-medium leading-snug tracking-[-0.02em] sm:text-4xl">
            It is software you control.{" "}
            <span className="text-muted-foreground">
              It does not predict markets, it does not manage money for you, and it cannot
              guarantee any result.
            </span>
          </p>
        </Reveal>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
          <Reveal delay={100}>
            <h3 className="font-display text-sm font-semibold">What you need</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Your own Deriv account (demo or real) and its API token or authorisation.</li>
              <li>An email address to create a profile in this app.</li>
              <li>To be 18 or older and legally allowed to trade where you live.</li>
              <li>A stable internet connection while the bot runs.</li>
            </ul>
          </Reveal>
          <Reveal delay={180}>
            <h3 className="font-display text-sm font-semibold">What this is not</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Not financial, investment or tax advice.</li>
              <li>Not a broker. Deriv holds your funds and executes your trades.</li>
              <li>Not a guarantee of profit, and not risk-free.</li>
              <li>Not a managed account or signal service.</li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------- CTA -------------------------------- */

function CallToAction() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <Reveal variant="scale">
        <div className="hero-wash relative overflow-hidden rounded-3xl border border-border px-6 py-16 text-center sm:px-12">
          <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Start on a demo account
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Create a profile, connect Deriv and run your first session with demo funds before
              you consider anything real.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/dashboard">
                <Button size="lg" className="h-12 rounded-full px-8 text-sm">
                  Open the app
                </Button>
              </Link>
              <Link to="/risk">
                <Button size="lg" variant="ghost" className="h-12 rounded-full px-6 text-sm text-muted-foreground">
                  Read the risk disclaimer
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["/risk", "Risk disclaimer", "The risks of trading with this software."],
          ["/terms", "Terms and conditions", "The rules for using the app."],
          ["/privacy", "Privacy policy", "How your information is handled under POPIA."],
        ].map(([to, t, d], i) => (
          <Reveal key={to} delay={i * 70}>
            <Link to={to} className="lift group flex h-full items-start justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-5">
              <div>
                <h3 className="font-display text-sm font-semibold tracking-tight">{t}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
              </div>
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}


