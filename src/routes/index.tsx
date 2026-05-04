import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDerivBot } from "@/hooks/useDerivBot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ThDpstSmrtTrdr — Digits Differ Bot" },
      { name: "description", content: "Automated Digits Differ trading on Volatility 100 via Deriv API." },
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
  const { state, cfg, setCfg, start, stop, reset, connect } = useDerivBot();
  const s = state!;
  const pnlAnim = useAnimatedNumber(s?.pnl ?? 0);

  const statusColor = !s?.connected
    ? "text-muted-foreground"
    : s?.running
    ? "text-bull"
    : "text-warn";
  const statusLabel = !s?.connected ? "Disconnected" : s?.running ? "Running" : s?.authorized ? "Idle" : "Connecting…";

  const digits = useMemo(() => s?.ticks.slice(0, 30).map((t) => t.digit) ?? [], [s?.ticks]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-sm bg-primary/20 grid place-items-center">
            <div className="h-2 w-2 rounded-sm bg-primary" />
          </div>
          <h1 className="font-display text-base font-semibold tracking-tight">
            ThDpstSmrtTrdr<span className="text-muted-foreground"> · Digits Differ</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className={`status-dot inline-block h-2 w-2 rounded-full ${statusColor}`} style={{ backgroundColor: "currentColor" }} />
            <span className={statusColor}>{statusLabel}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            {s?.currency} <span className="text-foreground">{s?.balance != null ? s.balance.toFixed(2) : "—"}</span>
          </div>
        </div>
      </header>

      <main className="grid gap-px bg-border grid-cols-1 lg:[grid-template-columns:minmax(280px,320px)_1fr_minmax(260px,300px)]">
        {/* LEFT: Controls */}
        <section className="bg-background p-5 space-y-5">
          <SectionLabel>Connection</SectionLabel>
          <Field label="API Token (Deriv)">
            <input
              type="password"
              value={cfg.token}
              onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
              placeholder="Paste demo API token"
              className="input"
              autoComplete="off"
            />
          </Field>
          <button
            className="btn-secondary w-full"
            onClick={connect}
            disabled={!cfg.token || s?.connected}
          >
            {s?.authorized ? "Connected" : s?.connected ? "Authorizing…" : "Connect"}
          </button>

          <Divider />
          <SectionLabel>Strategy</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Digit">
              <select
                className="input"
                value={cfg.targetDigit}
                onChange={(e) => setCfg({ ...cfg, targetDigit: Number(e.target.value) })}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </Field>
            <Field label="Repetitions">
              <NumInput value={cfg.repetitionCount} min={1} step={1} onChange={(v) => setCfg({ ...cfg, repetitionCount: Math.max(1, v) })} />
            </Field>
            <Field label="Stake (USD)">
              <NumInput value={cfg.stake} min={0.35} step={0.5} onChange={(v) => setCfg({ ...cfg, stake: v })} />
            </Field>
            <Field label="App ID">
              <input className="input" value={cfg.appId} onChange={(e) => setCfg({ ...cfg, appId: e.target.value })} />
            </Field>
          </div>

          <Divider />
          <SectionLabel>Risk</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop Loss ($)">
              <NumInput value={cfg.stopLoss} min={0} step={1} onChange={(v) => setCfg({ ...cfg, stopLoss: v })} />
            </Field>
            <Field label="Take Profit ($)">
              <NumInput value={cfg.takeProfit} min={0} step={1} onChange={(v) => setCfg({ ...cfg, takeProfit: v })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {!s?.running ? (
              <button className="btn-primary col-span-1" onClick={start} disabled={!s?.authorized}>Start Bot</button>
            ) : (
              <button className="btn-danger col-span-1" onClick={stop}>Stop Bot</button>
            )}
            <button className="btn-ghost" onClick={reset}>Reset</button>
          </div>

          {s?.error && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
              {s.error}
            </div>
          )}
        </section>

        {/* CENTER: Live tick + digit */}
        <section className="bg-background p-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Panel title="Last Digit" hint={`${cfg.symbol === "R_100" ? "Volatility 100 Index" : cfg.symbol}`}>
              <div className="flex items-end justify-between gap-6">
                <div
                  key={s?.lastDigit ?? "—"}
                  className={`font-mono text-[112px] leading-none tracking-tight tick-pulse ${
                    s?.lastDigit === cfg.targetDigit ? "text-primary digit-glow" : "text-foreground"
                  }`}
                >
                  {s?.lastDigit ?? "—"}
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Price</div>
                  <div className="font-mono text-xl">{s?.lastPrice?.toFixed(2) ?? "—"}</div>
                  <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Streak</div>
                  <div className="font-mono text-xl">
                    <span className={s && s.streak > 0 ? "text-warn" : ""}>{s?.streak ?? 0}</span>
                    <span className="text-muted-foreground"> / {cfg.repetitionCount}</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {digits.map((d, i) => (
                  <span
                    key={i}
                    className={`font-mono text-xs h-7 w-7 grid place-items-center rounded ${
                      d === cfg.targetDigit ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground"
                    }`}
                  >
                    {d}
                  </span>
                ))}
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
                          {new Date(t.time).toLocaleTimeString([], { hour12: false })}
                        </span>
                        <span>{t.price.toFixed(2)}</span>
                        <span className={t.digit === cfg.targetDigit ? "text-primary" : ""}>·{t.digit}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No ticks yet. Connect & start the bot.</EmptyState>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Trade Log" hint={`${s?.trades.length ?? 0} trade${(s?.trades.length ?? 0) === 1 ? "" : "s"}`}>
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
                        <td className="py-2 pr-4 text-muted-foreground">{new Date(t.time).toLocaleTimeString([], { hour12: false })}</td>
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
                        <td className={`py-2 pr-0 text-right ${t.profit == null ? "" : t.profit >= 0 ? "text-bull" : "text-bear"}`}>
                          {t.profit == null ? "—" : `${t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}`}
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
        <section className="bg-background p-5 space-y-5">
          <SectionLabel>Session</SectionLabel>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Net P/L</div>
            <div className={`font-mono text-4xl tracking-tight ${pnlAnim >= 0 ? "text-bull" : "text-bear"}`}>
              {pnlAnim >= 0 ? "+" : ""}{pnlAnim.toFixed(2)}
              <span className="text-base text-muted-foreground"> {s?.currency}</span>
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
          <Row k="Streak" v={`${s?.streak ?? 0} / ${cfg.repetitionCount}`} />
          <Row k="Symbol" v="R_100" />
          <Row k="Duration" v="1 tick" />

          <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Token stays in your browser only — never sent to any third-party server. Use a Deriv demo token.
          </p>
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
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function NumInput({ value, onChange, min, step }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <input
      type="number"
      className="input"
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
function Divider() { return <div className="h-px bg-border" />; }
function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "bull" | "bear" }) {
  const color = accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-md bg-surface px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg ${color}`}>{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center py-8 text-xs text-muted-foreground">{children}</div>;
}
