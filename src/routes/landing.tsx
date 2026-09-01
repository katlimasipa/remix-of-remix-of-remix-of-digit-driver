import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/landing")({ component: Landing });

const STRATEGIES = [
  {
    name: "Specific digit",
    desc: "Waits for one digit you choose to repeat a set number of times in a row before entering.",
  },
  {
    name: "Any digit",
    desc: "Waits for any digit to repeat your chosen number of times in a row.",
  },
  {
    name: "XXXYYY = Z",
    desc: "Waits for three matching digits followed by three matching digits of a different value, then uses the first digit as the barrier.",
  },
  { name: "Odd reps", desc: "Only counts repetition streaks made of odd digits." },
  { name: "Even reps", desc: "Only counts repetition streaks made of even digits." },
  {
    name: "TH DPST Strtgy",
    desc: "Cycles through the strategies you tick, moving to the next one after each trade settles.",
  },
];

const STEPS = [
  {
    t: "Create a profile",
    d: "Sign up with an email and password. This profile is what links your devices together so alerts reach all of them.",
  },
  {
    t: "Connect your Deriv account",
    d: "Authorise your Deriv account, or paste a Deriv API token. Demo and real accounts are kept separate, each with its own token.",
  },
  {
    t: "Pick a strategy",
    d: "Choose an entry strategy and set the repetition count. Optionally require a failed cycle first, so the bot skips an occurrence and only enters after the streak has run past your target.",
  },
  {
    t: "Set your risk limits",
    d: "Set your stake, stop loss and take profit. The bot stops itself when either limit is reached.",
  },
  {
    t: "Start the bot",
    d: "It streams live ticks from Deriv, watches the last digit of each tick and places a Digits Differ contract when your pattern appears.",
  },
  {
    t: "Track results",
    d: "Watch the tick stream, trade log and running P/L. Push notifications tell you when the bot starts, stops, wins or loses, and when a stop loss or take profit is hit.",
  },
  {
    t: "Save the session",
    d: "End and save a run to store it in your session history, kept separately for demo and real accounts.",
  },
];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/70 px-4 py-3 backdrop-blur-xl pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <span className="font-display text-sm font-semibold tracking-tight">ThDpstSmrtTrdr</span>
          <nav className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <a href="#how" className="hidden transition-colors hover:text-primary sm:inline">
              How it works
            </a>
            <Link to="/risk" className="transition-colors hover:text-primary">
              Risk
            </Link>
            <Link
              to="/"
              className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-5 pb-10 pt-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Deriv trading automation software
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            A last-digit pattern bot for Deriv, with your rules and your risk limits.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">
            ThDpstSmrtTrdr connects to your own Deriv account, watches the last digit of live tick
            data and places Digits Differ contracts when the repetition pattern you configured
            appears. It is software you control. It does not predict markets, it does not manage
            money for you, and it cannot guarantee any result. Trading derivatives is high risk and
            you can lose all the money you put in.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open the app
            </Link>
            <a
              href="#how"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              See how it works
            </a>
          </div>
          <div className="mt-8 rounded-xl border border-bear/40 bg-bear/10 p-4 text-xs leading-6 text-bear">
            Risk warning: trading is high risk and you can lose all of your money. Past performance
            does not guarantee future results. Only trade with money you can afford to lose. Test on
            a demo account first.
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5">
          <div className="h-px bg-border" />
        </div>

        {/* What it does */}
        <section className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">What the app does</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "Live tick stream",
                "Connects to Deriv over WebSocket and shows each incoming tick and its last digit, with repetition streaks colour-coded.",
              ],
              [
                "Digits Differ contracts",
                "When your pattern triggers, the bot buys a Digits Differ contract on your chosen symbol at your chosen stake.",
              ],
              [
                "Demo or real",
                "Use a demo account or a real account. Each keeps its own saved credentials and its own session history.",
              ],
              [
                "Stop loss and take profit",
                "You set both. The bot stops itself and notifies you when either is reached.",
              ],
              [
                "Session history",
                "Every saved run stores profit and loss, wins, losses, trade count and the settings used.",
              ],
              [
                "Cross-device alerts",
                "Optional web push notifications reach every device signed in to your profile, including when the app is in the background.",
              ],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-border bg-surface/40 p-5">
                <h3 className="font-display text-sm font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            How it works, step by step
          </h2>
          <ol className="mt-6 space-y-3">
            {STEPS.map((s, i) => (
              <li
                key={s.t}
                className="flex gap-4 rounded-xl border border-border bg-surface/40 p-5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 font-mono text-xs text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold tracking-tight">{s.t}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Strategies */}
        <section className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Entry strategies</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            Each strategy is only a rule for when to place a trade. None of them predicts the market
            and none of them changes the odds of the underlying contract.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {STRATEGIES.map((s) => (
              <div key={s.name} className="rounded-xl border border-border bg-surface/40 p-5">
                <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-surface/40 p-5 text-sm leading-6 text-muted-foreground">
            Any strategy can be set to wait for a failed cycle first: the bot skips the first
            matching pattern and only enters once the streak has continued past your target
            repetition count.
          </div>
        </section>

        {/* Requirements + honesty */}
        <section className="mx-auto max-w-5xl px-5 py-12">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface/40 p-5">
              <h2 className="font-display text-base font-semibold tracking-tight">
                What you need
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Your own Deriv account (demo or real) and its API token or authorisation.</li>
                <li>An email address to create a profile in this app.</li>
                <li>To be 18 years or older and legally allowed to trade where you live.</li>
                <li>A stable internet connection while the bot runs.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-surface/40 p-5">
              <h2 className="font-display text-base font-semibold tracking-tight">
                What this is not
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Not financial, investment or tax advice.</li>
                <li>Not a broker. Deriv holds your funds and executes your trades.</li>
                <li>Not a guarantee of profit, and not risk-free.</li>
                <li>Not a managed account or signal service.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Legal links */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["/risk", "Risk disclaimer", "The risks of trading with this software."],
              ["/terms", "Terms and conditions", "The rules for using the app."],
              ["/privacy", "Privacy policy", "How your personal information is handled under POPIA."],
            ].map(([to, t, d]) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl border border-border bg-surface/40 p-5 transition-colors hover:border-primary/50"
              >
                <h3 className="font-display text-sm font-semibold tracking-tight">{t}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
