import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDerivBot } from "@/hooks/useDerivBot";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { AuthScreen } from "@/components/AuthScreen";
import { Footer } from "@/components/Footer";
import { SessionHistory } from "@/components/SessionHistory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Save, Archive, Sun, Moon, Settings, Activity, BarChart3, History, Bell, BellOff } from "lucide-react";

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
  const { user, loading, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
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
  const [accountType, setAccountType] = useState<"demo" | "real">("demo");
  const [demoToken, setDemoToken] = useState("");
  const [realToken, setRealToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [confirmReal, setConfirmReal] = useState(false);
  const [sessionStart, setSessionStart] = useState<number>(() => Date.now());
  const [historyKey, setHistoryKey] = useState(0);
  const [savingSession, setSavingSession] = useState(false);

  async function endAndSaveSession() {
    if (!user) return;
    if (!s || s.totalTrades === 0) {
      // Just reset if nothing to save
      stop();
      reset();
      setSessionStart(Date.now());
      return;
    }
    setSavingSession(true);
    stop();
    const { error } = await supabase.from("trading_sessions").insert({
      user_id: user.id,
      account_type: accountType,
      pnl: Number(s.pnl.toFixed(4)),
      wins: s.wins,
      losses: s.losses,
      total_trades: s.totalTrades,
      stake: cfg.stake,
      target_digit: cfg.targetDigit,
      repetition_count: cfg.repetitionCount,
      started_at: new Date(sessionStart).toISOString(),
      ended_at: new Date().toISOString(),
    });
    setSavingSession(false);
    if (!error) {
      reset();
      setSessionStart(Date.now());
      setHistoryKey((k) => k + 1);
    }
  }

  const activeToken = accountType === "real" ? realToken : demoToken;

  // Keep the bot's config in sync with the currently-typed token so users
  // don't have to click "Save" before "Connect".
  useEffect(() => {
    setCfg((c) => (c.token === activeToken ? c : { ...c, token: activeToken }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  // Auto-connect once tokens have loaded and a saved token exists.
  const autoConnectedRef = useRef(false);
  useEffect(() => {
    if (!tokenLoaded) return;
    if (autoConnectedRef.current) return;
    if (!activeToken) return;
    if (s?.connected || s?.authorized) return;
    autoConnectedRef.current = true;
    // Defer to allow cfg sync effect above to run first.
    setTimeout(() => connect(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenLoaded, activeToken]);

  // ---------- Trade notifications (Web Notifications API) ----------
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  const seenTradesRef = useRef<Set<string>>(new Set());
  // Seed seen set with any open trades that already exist so we don't spam on mount
  useEffect(() => {
    if (!s?.trades) return;
    for (const t of s.trades) {
      if (t.status !== "open" && !seenTradesRef.current.has(t.id)) {
        // already settled before we started watching — mark as seen, no notify
        seenTradesRef.current.add(t.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notifSupported || notifPerm !== "granted") return;
    if (!s?.trades) return;
    for (const t of s.trades) {
      if (t.status === "open") continue;
      if (seenTradesRef.current.has(t.id)) continue;
      seenTradesRef.current.add(t.id);
      const won = t.status === "won";
      const profit = typeof t.profit === "number" ? t.profit : 0;
      const title = won ? "✅ Trade won" : "❌ Trade lost";
      const body = `${won ? "+" : ""}${profit.toFixed(2)} ${s.currency} · Digit ${t.digit} · Session P/L ${s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}`;
      try {
        const n = new Notification(title, {
          body,
          icon: "/app-icon.png",
          badge: "/app-icon.png",
          tag: `trade-${t.id}`,
          silent: false,
        });
        // Auto-close after 6s on desktop; mobile ignores this
        setTimeout(() => n.close(), 6000);
        // Vibrate on mobile (separate from Notification API)
        if ("vibrate" in navigator) navigator.vibrate(won ? [80, 40, 80] : [200]);
      } catch {
        // ignore
      }
    }
  }, [s?.trades, notifPerm, notifSupported, s?.currency, s?.pnl]);

  async function requestNotifications() {
    if (!notifSupported) return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      if (p === "granted") {
        new Notification("Notifications enabled", {
          body: "You'll get an alert each time a trade is won or lost.",
          icon: "/app-icon.png",
        });
      }
    } catch {
      // ignore
    }
  }

  const digits = useMemo(() => s?.ticks.slice(0, 30).map((t) => t.digit) ?? [], [s?.ticks]);

  // Load tokens + preferred account type from profile
  useEffect(() => {
    if (!user) {
      setTokenLoaded(false);
      setDemoToken("");
      setRealToken("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("deriv_token_demo, deriv_token_real, account_type")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const dt = data?.deriv_token_demo ?? "";
      const rt = data?.deriv_token_real ?? "";
      const at = (data?.account_type === "real" ? "real" : "demo") as "demo" | "real";
      setDemoToken(dt);
      setRealToken(rt);
      setAccountType(at);
      setCfg((c) => ({ ...c, token: at === "real" ? rt : dt }));
      setTokenLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // When user switches account type, swap active token & disconnect any active session
  function switchAccount(next: "demo" | "real") {
    if (next === accountType) return;
    if (next === "real" && !confirmReal) {
      setConfirmReal(true);
      return;
    }
    setAccountType(next);
    setConfirmReal(false);
    disconnect();
    const tok = next === "real" ? realToken : demoToken;
    setCfg({ ...cfg, token: tok });
    if (user) {
      supabase.from("profiles").update({ account_type: next }).eq("id", user.id);
    }
  }

  async function saveToken() {
    if (!user) return;
    setSavingToken(true);
    setSavedMsg(null);
    const patch = accountType === "real"
      ? { deriv_token_real: realToken }
      : { deriv_token_demo: demoToken };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setSavingToken(false);
    if (error) setSavedMsg("Save failed");
    else {
      setCfg({ ...cfg, token: activeToken });
      setSavedMsg(`${accountType === "real" ? "Real" : "Demo"} token saved`);
      setTimeout(() => setSavedMsg(null), 2000);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <AuthScreen />;

  const statusColor = !s?.connected
    ? "text-muted-foreground"
    : s?.running
    ? "text-bull"
    : "text-warn";
  const statusLabel = !s?.connected ? "Disconnected" : s?.running ? "Running" : s?.authorized ? "Idle" : "Connecting…";


  const ControlsPanel = (
    <section className="bg-background p-4 sm:p-5 space-y-5">
          <SectionLabel>Connection</SectionLabel>

          {/* Account type toggle */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground">Account</span>
            <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-xs">
              {(["demo", "real"] as const).map((m) => {
                const active = accountType === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchAccount(m)}
                    className={`flex-1 rounded px-3 py-1.5 font-medium transition-all ${
                      active
                        ? m === "real"
                          ? "bg-bear text-white"
                          : "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "demo" ? "Demo" : "Real"}
                  </button>
                );
              })}
            </div>
            {accountType === "real" && !s?.authorized && (
              <div className="rounded-md border border-bear/40 bg-bear/10 px-2.5 py-1.5 text-[11px] text-bear">
                Live trading uses real funds. Trade at your own risk.
              </div>
            )}
            {confirmReal && accountType === "demo" && (
              <div className="space-y-1.5 rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2 text-[11px] text-warn">
                <div>Switching to <b>Real</b> will trade with real money. Confirm?</div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => switchAccount("real")}
                    className="rounded bg-bear px-2 py-1 text-[11px] text-white"
                  >
                    Confirm Real
                  </button>
                  <button
                    onClick={() => setConfirmReal(false)}
                    className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <Field label={`${accountType === "real" ? "Real" : "Demo"} API Token`}>
            <input
              type="password"
              value={accountType === "real" ? realToken : demoToken}
              onChange={(e) => {
                const v = e.target.value;
                if (accountType === "real") setRealToken(v);
                else setDemoToken(v);
              }}
              placeholder={tokenLoaded ? `Paste ${accountType} API token` : "Loading…"}
              className="input"
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secondary inline-flex items-center justify-center gap-1.5"
              onClick={saveToken}
              disabled={savingToken || !activeToken}
            >
              <Save className="h-3.5 w-3.5" />
              {savingToken ? "Saving…" : "Save"}
            </button>
            <button
              className="btn-secondary"
              onClick={connect}
              disabled={!activeToken || s?.connected}
            >
              {s?.authorized ? "Connected" : s?.connected ? "Authorizing…" : "Connect"}
            </button>
          </div>
          {savedMsg && (
            <div className="text-[11px] text-muted-foreground">{savedMsg}</div>
          )}

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
          <button
            className="btn-secondary w-full inline-flex items-center justify-center gap-1.5"
            onClick={endAndSaveSession}
            disabled={savingSession || !s || s.totalTrades === 0}
          >
            <Archive className="h-3.5 w-3.5" />
            {savingSession ? "Saving…" : "End & Save Session"}
          </button>

          {s?.error && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
              {s.error}
            </div>
          )}
        </section>
  );

  const LivePanel = (
    <section className="bg-background p-4 sm:p-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Panel title="Last Digit" hint={`${cfg.symbol === "R_100" ? "Volatility 100 Index" : cfg.symbol}`}>
              <div className="flex items-end justify-between gap-4">
                <div
                  key={s?.lastDigit ?? "—"}
                  className={`font-mono text-[80px] sm:text-[112px] leading-none tracking-tight tick-pulse ${
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
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[440px]">
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
  );

  const StatsPanel = (
    <section className="bg-background p-4 sm:p-5 space-y-5">
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
            Tokens stay in your browser only — never sent to any third-party server. Demo and Real tokens are stored separately on your account.
          </p>
        </section>
  );

  const HistoryPanel = (
    <section className="bg-background p-4 sm:p-5">
      <SessionHistory userId={user.id} refreshKey={historyKey} />
    </section>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 sm:px-6 py-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-6 w-6 shrink-0 rounded-sm bg-primary/20 grid place-items-center">
            <div className="h-2 w-2 rounded-sm bg-primary" />
          </div>
          <h1 className="font-display text-sm sm:text-base font-semibold tracking-tight truncate">
            ThDpstSmrtTrdr<span className="hidden sm:inline text-muted-foreground"> · Digits Differ</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className={`status-dot inline-block h-2 w-2 rounded-full ${statusColor}`} style={{ backgroundColor: "currentColor" }} />
            <span className={statusColor}>{statusLabel}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            <span className="hidden sm:inline">{s?.currency} </span>
            <span className="text-foreground">{s?.balance != null ? s.balance.toFixed(2) : "—"}</span>
          </div>
          <div className="hidden md:block text-muted-foreground font-mono max-w-[160px] truncate">{user.email}</div>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-md border border-border h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 sm:px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* Mobile / tablet: tabbed layout */}
      <div className="lg:hidden">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="sticky top-0 z-10 grid w-full grid-cols-4 rounded-none border-b border-border bg-background h-11 p-1">
            <TabsTrigger value="controls" className="text-xs gap-1.5"><Settings className="h-3.5 w-3.5" /><span className="inline">Controls</span></TabsTrigger>
            <TabsTrigger value="live" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" /><span className="inline">Live</span></TabsTrigger>
            <TabsTrigger value="stats" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /><span className="inline">Stats</span></TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5"><History className="h-3.5 w-3.5" /><span className="inline">History</span></TabsTrigger>
          </TabsList>
          <TabsContent value="controls" className="mt-0">{ControlsPanel}</TabsContent>
          <TabsContent value="live" className="mt-0">{LivePanel}</TabsContent>
          <TabsContent value="stats" className="mt-0">{StatsPanel}</TabsContent>
          <TabsContent value="history" className="mt-0">{HistoryPanel}</TabsContent>
        </Tabs>
      </div>

      {/* Desktop: 3-column grid */}
      <main className="hidden lg:grid gap-px bg-border grid-cols-1 lg:[grid-template-columns:minmax(280px,320px)_1fr_minmax(260px,300px)]">
        {ControlsPanel}
        <div className="bg-background">
          {LivePanel}
          {HistoryPanel}
        </div>
        {StatsPanel}
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
