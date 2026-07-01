import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDerivBot } from "@/hooks/useDerivBot";
import { useDerivAuth } from "@/hooks/useDerivAuth";
import type { TriggerMode } from "@/lib/derivBot";
import { AuthScreen } from "@/components/AuthScreen";
import { Footer } from "@/components/Footer";
import { LogOut, Settings2, Activity, BarChart3, Bell, BellOff } from "lucide-react";
import { PwaInstallBanner, PwaInstallButton } from "@/components/PwaInstall";
import { useTradeNotifications } from "@/hooks/useTradeNotifications";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThDpstSmrtTrdr — Digits Differ Bot" },
      {
        name: "description",
        content: "Automated Digits Differ trading on Volatility 100 via Deriv API.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Dashboard,
});

function useAnimatedNumber(value: number, duration = 400) {
  const [v, setV] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const start = ref.current;
    const delta = value - start;
    if (delta === 0) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = start + delta * eased;
      setV(next);
      ref.current = next;
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return v;
}

function Dashboard() {
  const { authState, accounts, activeAccount, wsUrl, logout, switchAccount } = useDerivAuth();
  const { state, cfg, setCfg, start, stop, reset, connect, disconnect } = useDerivBot();
  const s = state ?? {
    connected: false,
    running: false,
    authorized: false,
    balance: null,
    currency: "USD",
    lastDigit: null,
    lastPrice: null,
    streak: 0,
    streakDigit: null,
    ticks: [],
    trades: [],
    pnl: 0,
    wins: 0,
    losses: 0,
    totalTrades: 0,
    error: null,
    pendingTrade: false,
  };
  const pnlAnim = useAnimatedNumber(s?.pnl ?? 0);
  const [mobileTab, setMobileTab] = useState<"controls" | "live" | "stats">("live");

  // Keep bot configured with the active wsUrl
  useEffect(() => {
    setCfg((c) => ({ ...c, wsUrl }));
    // If wsUrl changed, disconnect the old socket so the user can connect again
    disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  const digits = useMemo(() => s?.ticks.slice(0, 30).map((t) => t.digit) ?? [], [s?.ticks]);
  const streakMap = useMemo(
    () => computeStreakHighlights(digits, cfg.triggerMode, cfg.targetDigit, cfg.repetitionCount),
    [digits, cfg.triggerMode, cfg.targetDigit, cfg.repetitionCount],
  );
  const notifications = useTradeNotifications(accounts, s);

  if (authState === 'authenticating') {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-xs text-muted-foreground">
        Authenticating…
      </div>
    );
  }
  
  if (authState !== 'authenticated' || !activeAccount) {
    return <AuthScreen />;
  }

  const statusColor = !s?.connected
    ? "text-muted-foreground"
    : s?.running
      ? "text-bull"
      : "text-warn";
  const statusLabel = !s?.connected
    ? "Disconnected"
    : s?.running
      ? "Running"
      : s?.authorized
        ? "Idle"
        : "Connecting…";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] lg:pb-0 px-safe">
      <header className="flex items-center justify-between border-b border-border px-3 sm:px-6 py-3 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-6 w-6 shrink-0 rounded-sm bg-primary/20 grid place-items-center">
            <div className="h-2 w-2 rounded-sm bg-primary" />
          </div>
          <h1 className="font-display text-sm sm:text-base font-semibold tracking-tight truncate">
            ThDpstSmrtTrdr
            <span className="hidden sm:inline text-muted-foreground"> · Digits Differ</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`status-dot inline-block h-2 w-2 rounded-full ${statusColor}`}
              style={{ backgroundColor: "currentColor" }}
            />
            <span className={`${statusColor} hidden xs:inline`}>{statusLabel}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            <span className="hidden sm:inline">{s?.currency} </span>
            <span className="text-foreground">
              {s?.balance != null ? s.balance.toFixed(2) : "—"}
            </span>
          </div>
          
          <select 
            value={activeAccount.account_id}
            onChange={(e) => switchAccount(e.target.value)}
            className="hidden md:block bg-surface border border-border rounded px-2 py-1 outline-none text-xs"
          >
            {accounts.map(acc => (
              <option key={acc.account_id} value={acc.account_id}>
                {acc.account_id} ({acc.account_type === 'demo' ? 'Demo' : 'Real'})
              </option>
            ))}
          </select>

          <PwaInstallButton />

          {notifications.supported && (
            <button
              onClick={() => void notifications.enable()}
              disabled={notifications.denied}
              className="inline-flex items-center justify-center rounded-md border border-border h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                notifications.requiresInstall
                  ? "Install the app to your Home Screen first (iOS), then enable notifications"
                  : notifications.enabled
                    ? "Trade notifications enabled on all devices"
                    : notifications.denied
                      ? "Notifications blocked — enable in browser settings"
                      : "Enable trade notifications on all devices"
              }
            >
              {notifications.enabled ? (
                <Bell className="h-3.5 w-3.5 text-primary" />
              ) : (
                <BellOff className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          
          <button
            onClick={() => {
              disconnect();
              logout();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <main className="grid gap-px bg-border grid-cols-1 lg:[grid-template-columns:minmax(280px,320px)_1fr_minmax(260px,300px)]">
        {/* LEFT: Controls */}
        <section
          className={`bg-background p-4 sm:p-5 space-y-5 ${mobileTab === "controls" ? "" : "hidden"} lg:block`}
        >
          <SectionLabel>Connection</SectionLabel>

          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground">Active Account</span>
            <div className={`rounded-md border border-border px-3 py-2 font-mono text-sm font-medium ${activeAccount.account_type === 'real' ? 'bg-bear/10 text-bear border-bear/20' : 'bg-surface'}`}>
              {activeAccount.account_id}
            </div>
            {activeAccount.account_type === 'real' && (
              <div className="text-[11px] text-bear">
                Live trading uses real funds. Trade at your own risk.
              </div>
            )}
          </div>

          <button
            className="btn-secondary w-full"
            onClick={connect}
            disabled={!wsUrl || s?.connected}
          >
            {s?.authorized ? "Connected" : s?.connected ? "Authorizing…" : "Connect Bot"}
          </button>

          <Divider />
          <SectionLabel>Strategy</SectionLabel>
          <Field label="Mode">
            <select
              className="input"
              value={cfg.triggerMode}
              onChange={(e) =>
                setCfg({ ...cfg, triggerMode: e.target.value as TriggerMode })
              }
            >
              <option value="specific">Specific digit</option>
              <option value="any">Any digit</option>
              <option value="xxyyy">XXYYY = Z</option>
              <option value="xxxyy">XXXYY = Z</option>
              <option value="odd">Odd reps</option>
              <option value="even">Even reps</option>
            </select>
          </Field>
          <p className="text-[10px] text-muted-foreground/80 -mt-2">
            {cfg.triggerMode === "any"
              ? "Trades when any digit repeats N times in a row."
              : cfg.triggerMode === "xxyyy"
                ? "Detects XX YYY pattern; predicts next digit differs from Y."
                : cfg.triggerMode === "xxxyy"
                  ? "Detects XXX YY pattern; predicts next digit differs from Y."
                  : cfg.triggerMode === "odd"
                    ? "Trades when an odd digit repeats N times."
                    : cfg.triggerMode === "even"
                      ? "Trades when an even digit repeats N times."
                      : "Trades when the target digit repeats N times."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {cfg.triggerMode === "specific" && (
              <Field label="Target Digit">
                <select
                  className="input"
                  value={cfg.targetDigit}
                  onChange={(e) => setCfg({ ...cfg, targetDigit: Number(e.target.value) })}
                >
                  {Array.from({ length: 10 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {cfg.triggerMode !== "xxyyy" && cfg.triggerMode !== "xxxyy" && (
              <Field label="Repetitions">
                <NumInput
                  value={cfg.repetitionCount}
                  min={1}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, repetitionCount: Math.max(1, v) })}
                />
              </Field>
            )}
            <Field label="Stake (USD)">
              <NumInput
                value={cfg.stake}
                min={0.35}
                step={0.5}
                onChange={(v) => setCfg({ ...cfg, stake: v })}
              />
            </Field>
          </div>

          <Divider />
          <SectionLabel>Risk</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop Loss ($)">
              <NumInput
                value={cfg.stopLoss}
                min={0}
                step={1}
                onChange={(v) => setCfg({ ...cfg, stopLoss: v })}
              />
            </Field>
            <Field label="Take Profit ($)">
              <NumInput
                value={cfg.takeProfit}
                min={0}
                step={1}
                onChange={(v) => setCfg({ ...cfg, takeProfit: v })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {!s?.running ? (
              <button className="btn-primary col-span-1" onClick={start} disabled={!s?.authorized}>
                Start Bot
              </button>
            ) : (
              <button className="btn-danger col-span-1" onClick={stop}>
                Stop Bot
              </button>
            )}
            <button className="btn-ghost" onClick={reset}>
              Reset
            </button>
          </div>

          {s?.error && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
              {s.error}
            </div>
          )}
        </section>

        {/* CENTER: Live tick + digit */}
        <section
          className={`bg-background p-4 sm:p-6 space-y-6 ${mobileTab === "live" ? "" : "hidden"} lg:block`}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Panel
              title="Last Digit"
              hint={`${cfg.symbol === "1HZ100V" ? "Volatility 100 Index" : cfg.symbol}`}
            >
              <div className="flex items-end justify-between gap-6">
                <div
                  key={s?.lastDigit ?? "—"}
                  className={`font-mono text-[112px] leading-none tracking-tight tick-pulse ${
                    cfg.triggerMode === "any" || s?.lastDigit === cfg.targetDigit
                      ? "text-primary digit-glow"
                      : "text-foreground"
                  }`}
                >
                  {s?.lastDigit ?? "—"}
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Price
                  </div>
                  <div className="font-mono text-xl">{s?.lastPrice?.toFixed(2) ?? "—"}</div>
                  <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                    {cfg.triggerMode === "any" ||
                    cfg.triggerMode === "odd" ||
                    cfg.triggerMode === "even"
                      ? `Reps (digit ${s?.streakDigit ?? "—"})`
                      : cfg.triggerMode === "xxyyy" || cfg.triggerMode === "xxxyy"
                        ? "Pattern"
                        : "Streak"}
                  </div>
                  <div className="font-mono text-xl">
                    <span className={s && s.streak > 0 ? "text-warn" : ""}>{s?.streak ?? 0}</span>
                    <span className="text-muted-foreground">
                      {cfg.triggerMode === "xxyyy" || cfg.triggerMode === "xxxyy"
                        ? ""
                        : ` / ${cfg.repetitionCount}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {digits.map((d, i) => {
                  const hl = streakMap[i];
                  return (
                    <span
                      key={i}
                      className={`font-mono text-xs h-7 w-7 grid place-items-center rounded transition-colors ${
                        hl ? "" : "bg-surface text-muted-foreground"
                      }`}
                      style={
                        hl
                          ? {
                              backgroundColor: `hsl(${hl} / 0.18)`,
                              color: `hsl(${hl})`,
                              boxShadow: `inset 0 0 0 1px hsl(${hl} / 0.35)`,
                            }
                          : undefined
                      }
                    >
                      {d}
                    </span>
                  );
                })}
                {digits.length === 0 && (
                  <span className="text-xs text-muted-foreground">Waiting for ticks…</span>
                )}
              </div>
            </Panel>

            <Panel title="Tick Stream">
              <div className="h-[260px] overflow-hidden font-mono text-xs">
                {s?.ticks.length ? (
                  <ul className="space-y-1">
                    {s.ticks.slice(0, 14).map((t, i) => (
                      <li key={t.time + "-" + i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {formatDateTime(t.time)}
                        </span>
                        <span>{t.price.toFixed(2)}</span>
                        <span className={t.digit === cfg.targetDigit ? "text-primary" : ""}>
                          ·{t.digit}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No ticks yet. Connect & start the bot.</EmptyState>
                )}
              </div>
            </Panel>
          </div>

          <Panel
            title="Trade Log"
            hint={`${s?.trades.length ?? 0} trade${(s?.trades.length ?? 0) === 1 ? "" : "s"}`}
          >
            {s?.trades.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-4 font-medium">Time</th>
                      <th className="py-2 pr-4 font-medium">Differ ≠</th>
                      <th className="py-2 pr-4 font-medium">Stake</th>
                      <th className="py-2 pr-4 font-medium">Result</th>
                      <th className="py-2 pr-0 font-medium text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {s.trades.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(t.time)}
                        </td>
                        <td className="py-2 pr-4">{t.digit}</td>
                        <td className="py-2 pr-4">{t.buyPrice.toFixed(2)}</td>
                        <td className="py-2 pr-4">
                          {t.status === "open" ? (
                            <span className="text-warn">open</span>
                          ) : t.status === "won" ? (
                            <span className="text-bull">win</span>
                          ) : (
                            <span className="text-bear">loss</span>
                          )}
                        </td>
                        <td
                          className={`py-2 pr-0 text-right ${t.profit == null ? "" : t.profit >= 0 ? "text-bull" : "text-bear"}`}
                        >
                          {t.profit == null
                            ? "—"
                            : `${t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>Trades will appear here once the bot fires.</EmptyState>
            )}
          </Panel>
        </section>

        {/* RIGHT: Stats */}
        <section
          className={`bg-background p-4 sm:p-5 space-y-5 ${mobileTab === "stats" ? "" : "hidden"} lg:block`}
        >
          <SectionLabel>Session</SectionLabel>
          <div
            className={`relative overflow-hidden rounded-xl border p-4 shadow-lg ${
              pnlAnim >= 0
                ? "border-bull/30 bg-gradient-to-br from-bull/15 via-bull/5 to-transparent"
                : "border-bear/30 bg-gradient-to-br from-bear/15 via-bear/5 to-transparent"
            }`}
          >
            <div
              className={`absolute inset-x-0 top-0 h-px ${pnlAnim >= 0 ? "bg-bull/50" : "bg-bear/50"}`}
            />
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Net P/L
              </div>
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  pnlAnim >= 0 ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                }`}
              >
                {pnlAnim >= 0 ? "Profit" : "Loss"}
              </div>
            </div>
            <div
              className={`mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums ${
                pnlAnim >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              {pnlAnim >= 0 ? "+" : ""}
              {pnlAnim.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {s?.currency}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Wins" value={s?.wins ?? 0} accent="bull" />
            <Stat label="Losses" value={s?.losses ?? 0} accent="bear" />
            <Stat label="Trades" value={s?.totalTrades ?? 0} />
            <Stat
              label="Win rate"
              value={`${s && s.totalTrades ? Math.round((s.wins / s.totalTrades) * 100) : 0}%`}
            />
          </div>

          <Divider />
          <SectionLabel>Bot</SectionLabel>
          <Row k="Status" v={statusLabel} />
          <Row k="Pending" v={s?.pendingTrade ? "yes" : "no"} />
          <Row
            k="Mode"
            v={
              cfg.triggerMode === "any"
                ? "Any digit"
                : cfg.triggerMode === "xxyyy"
                  ? "XXYYY = Z"
                  : cfg.triggerMode === "xxxyy"
                    ? "XXXYY = Z"
                    : cfg.triggerMode === "odd"
                      ? "Odd reps"
                      : cfg.triggerMode === "even"
                        ? "Even reps"
                        : `Digit ${cfg.targetDigit}`
            }
          />
          <Row
            k="Repetitions required"
            v={
              cfg.triggerMode === "xxyyy" || cfg.triggerMode === "xxxyy"
                ? "Pattern"
                : String(cfg.repetitionCount)
            }
          />
          <Row
            k={
              cfg.triggerMode === "any" ||
              cfg.triggerMode === "odd" ||
              cfg.triggerMode === "even"
                ? `Reps waited (digit ${s?.streakDigit ?? "—"})`
                : cfg.triggerMode === "xxyyy" || cfg.triggerMode === "xxxyy"
                  ? "Pattern streak"
                  : "Streak"
            }
            v={`${s?.streak ?? 0} / ${cfg.repetitionCount}`}
          />
          <Row k="Symbol" v="1HZ100V" />
          <Row k="Duration" v="1 tick" />

        </section>
      </main>

      <style>{`
        .input {
          width: 100%;
          background: var(--input);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
          font-family: var(--font-mono);
          color: var(--foreground);
          outline: none;
          transition: border-color .15s ease, background .15s ease;
        }
        .input:focus { border-color: var(--ring); }
        .btn-primary, .btn-secondary, .btn-danger, .btn-ghost {
          font-size: 13px; font-weight: 500; padding: 9px 12px;
          border-radius: 6px; transition: all .15s ease; cursor: pointer;
        }
        .btn-primary { background: var(--primary); color: var(--primary-foreground); }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
        .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
        .btn-secondary { background: var(--surface-2); color: var(--foreground); border: 1px solid var(--border); }
        .btn-secondary:hover:not(:disabled) { background: var(--accent); }
        .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-danger { background: var(--bear); color: white; }
        .btn-danger:hover { filter: brightness(1.05); }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--muted-foreground); }
        .btn-ghost:hover { color: var(--foreground); }
      `}</style>
      <Footer />
      <PwaInstallBanner aboveNav />

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-safe">
        <div className="grid grid-cols-3">
          {(
            [
              { id: "controls", label: "Controls", icon: Settings2 },
              { id: "live", label: "Live", icon: Activity },
              { id: "stats", label: "Stats", icon: BarChart3 },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = mobileTab === id;
            return (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "opacity-100" : "opacity-70"}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-3">{children}</h2>;
}
function Divider() {
  return <hr className="border-border my-6" />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-muted-foreground block">{label}</span>
      {children}
    </label>
  );
}
function NumInput({ value, min, step, onChange }: { value: number; min: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value || ""}
      min={min}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || min)}
      className="input"
    />
  );
}
function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "bull" | "bear" }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`font-mono text-xl ${accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : ""}`}>
        {value}
      </div>
    </div>
  );
}
function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-medium">{v}</span>
    </div>
  );
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-3 rounded-lg border border-dashed border-border bg-surface/30 p-8 text-center">
      <Activity className="h-6 w-6 text-muted-foreground/30" />
      <span className="text-xs text-muted-foreground">{children}</span>
    </div>
  );
}
