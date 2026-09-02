import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDerivBot } from "@/hooks/useDerivBot";
import { useDerivAuth } from "@/hooks/useDerivAuth";
import { useAppAuth } from "@/hooks/useAppAuth";
import type { TriggerMode } from "@/lib/derivBot";
import { AuthScreen } from "@/components/AuthScreen";
import { Footer } from "@/components/Footer";
import { LogOut, Settings2, Activity, BarChart3, Bell, BellOff, History, Save, Sun, Moon } from "lucide-react";
import { PwaInstallBanner, PwaInstallButton } from "@/components/PwaInstall";
import { useTradeNotifications } from "@/hooks/useTradeNotifications";
import { SessionHistory, saveSession } from "@/components/SessionHistory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/dashboard")({
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

const TH_DPST_ALL = ["specific", "any", "xxxyyy", "odd", "even"] as const satisfies readonly Exclude<TriggerMode, "th_dpst">[];

const TH_DPST_LABELS: Record<Exclude<TriggerMode, "th_dpst">, string> = {
  specific: "Specific digit",
  any: "Any digit",
  xxxyyy: "XXXYYY = Z",
  odd: "Odd reps",
  even: "Even reps",
};

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
  const { authState, error, login, signUp, accounts, activeAccount, wsUrl, logout, switchAccount, refreshWebSocketUrl } = useDerivAuth();
  const appAuth = useAppAuth();
  const { state, cfg, setCfg, start, stop, reset, connect, recoverConnection, disconnect, onEvent } = useDerivBot();
  const { theme, toggle: toggleTheme } = useTheme();
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
    remainingCycle: [] as ("specific" | "any" | "xxxyyy" | "odd" | "even")[],
    patternArmed: { specific: false, any: false, xxxyyy: false, odd: false, even: false },

  };
  const pnlAnim = useAnimatedNumber(s?.pnl ?? 0);
  const [mobileTab, setMobileTab] = useState<"controls" | "live" | "stats">("live");
  const [feedTab, setFeedTab] = useState<"log" | "history">("log");

  const sessionStartRef = useRef<number>(Date.now());
  const shouldStayConnectedRef = useRef(false);
  const reconnectingRef = useRef(false);

  const handleEndSession = () => {
    if (!s || s.totalTrades === 0) {
      alert("No trades in this session yet.");
      return;
    }
    saveSession({
      id: crypto.randomUUID(),
      accountId: activeAccount?.account_id ?? "unknown",
      accountType: (activeAccount?.account_type === "real" ? "real" : "demo"),
      startedAt: sessionStartRef.current,
      endedAt: Date.now(),
      pnl: s.pnl,
      wins: s.wins,
      losses: s.losses,
      totalTrades: s.totalTrades,
      stake: cfg.stake,
      triggerMode: cfg.triggerMode,
      targetDigit: cfg.targetDigit,
      repetitionCount: cfg.repetitionCount,
      currency: s.currency ?? "USD",
      trades: [...s.trades],
    });
    stop();
    reset();
    sessionStartRef.current = Date.now();
  };

  // Keep bot configured with the latest wsUrl (fresh OTP for next reconnect).
  // Do NOT disconnect on wsUrl refresh — that killed the bot on tab-change.
  useEffect(() => {
    setCfg((c) => ({ ...c, wsUrl }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  useEffect(() => {
    if (s.connected || s.running || s.authorized) shouldStayConnectedRef.current = true;
  }, [s.connected, s.running, s.authorized]);

  useEffect(() => {
    if (authState !== 'authenticated') return;

    const restoreConnection = async () => {
      if (reconnectingRef.current || !shouldStayConnectedRef.current) return;
      reconnectingRef.current = true;
      try {
        const refreshedUrl = await refreshWebSocketUrl();
        if (refreshedUrl) await recoverConnection(refreshedUrl);
      } catch {
        /* keep the current session instead of logging out on a transient refresh failure */
      } finally {
        reconnectingRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void restoreConnection();
    };

    window.addEventListener('focus', restoreConnection);
    window.addEventListener('online', restoreConnection);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', restoreConnection);
      window.removeEventListener('online', restoreConnection);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, refreshWebSocketUrl]);

  // Only disconnect when the actual active account changes.
  const prevAccountIdRef = useRef<string | null>(activeAccount?.account_id ?? null);
  useEffect(() => {
    const id = activeAccount?.account_id ?? null;
    if (prevAccountIdRef.current && prevAccountIdRef.current !== id) {
      shouldStayConnectedRef.current = false;
      disconnect();
    }
    prevAccountIdRef.current = id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.account_id]);

  const digits = useMemo(() => s?.ticks.slice(0, 30).map((t) => t.digit) ?? [], [s?.ticks]);
  const streakMap = useMemo(
    () => computeStreakHighlights(digits, cfg.triggerMode, cfg.targetDigit, cfg.repetitionCount),
    [digits, cfg.triggerMode, cfg.targetDigit, cfg.repetitionCount],
  );
  const dpstModes = useMemo(
    () =>
      cfg.thDpstModes?.length
        ? TH_DPST_ALL.filter((m) => cfg.thDpstModes!.includes(m))
        : [...TH_DPST_ALL],
    [cfg.thDpstModes],
  );
  const userOwnerKeys = useMemo(
    () => (appAuth.userId ? [`user:${appAuth.userId}`] : []),
    [appAuth.userId],
  );
  const notifications = useTradeNotifications(accounts, s, userOwnerKeys);

  // Fire push notifications on bot start / stop events.
  const notifyBotEventRef = useRef(notifications.notifyBotEvent);
  useEffect(() => {
    notifyBotEventRef.current = notifications.notifyBotEvent;
  }, [notifications.notifyBotEvent]);
  useEffect(() => {
    const unsub = onEvent((e) => {
      if (e.type === "bot_started" || e.type === "bot_stopped") {
        notifyBotEventRef.current(e);
      }
    });
    return () => {
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authState === 'authenticating') {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-xs text-muted-foreground">
        Authenticating...
      </div>
    );
  }
  
  if (appAuth.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!appAuth.user || authState !== 'authenticated' || !activeAccount) {
    return <AuthScreen login={login} signUp={signUp} authState={authState} error={error} />;
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
        : "Connecting...";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-8 px-safe">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-3 sm:px-6 py-2.5 gap-2 h-[3.25rem]">

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
          
          <Select value={activeAccount.account_id} onValueChange={switchAccount}>
            <SelectTrigger className="hidden md:flex bg-surface border border-border h-[26px] text-xs font-medium w-auto focus:ring-1 focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.account_id} value={acc.account_id}>
                  {acc.account_id} ({acc.account_type === 'demo' ? 'Demo' : 'Real'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <PwaInstallButton />

          {notifications.supported && (
            <button
              onClick={() => {
                if (notifications.enabled) {
                  void notifications.disable();
                } else {
                  void notifications.enable();
                }
              }}
              disabled={notifications.denied && !notifications.enabled}
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
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-md border border-border h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          
          <button
            onClick={() => {
              shouldStayConnectedRef.current = false;
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

      {/* Command bar — always visible, all screen sizes */}
      <div className="sticky top-[3.25rem] z-40 border-b border-border bg-surface/70 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/60">
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 pr-2 mr-1 border-r border-border/70 shrink-0">
            <span
              className={`status-dot inline-block h-1.5 w-1.5 rounded-full ${statusColor}`}
              style={{ backgroundColor: "currentColor" }}
            />
            <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
          </div>

          <div className="flex items-baseline gap-1.5 pr-3 mr-1 border-r border-border/70 shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Net P/L</span>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                pnlAnim >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              {pnlAnim >= 0 ? "+" : ""}
              {pnlAnim.toFixed(2)}
            </span>
          </div>

          <div className="hidden sm:flex items-baseline gap-1.5 pr-3 mr-1 border-r border-border/70 shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Trades</span>
            <span className="font-mono text-sm font-semibold tabular-nums">{s?.totalTrades ?? 0}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 shrink-0">
            {!s?.running ? (
              <button className="btn-primary px-4" onClick={start} disabled={!s?.authorized}>
                Start Bot
              </button>
            ) : (
              <button className="btn-danger px-4" onClick={stop}>
                Stop Bot
              </button>
            )}
            <button className="btn-ghost" onClick={reset} title="Reset session stats">
              Reset
            </button>
            <button
              onClick={handleEndSession}
              className="btn-secondary inline-flex items-center gap-1.5 whitespace-nowrap"
              disabled={!s || s.totalTrades === 0}
              title="Save the current session to history and reset stats"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">End &amp; Save</span>
              <span className="sm:hidden">Save</span>
            </button>
          </div>
        </div>

        {/* Top tabs (small screens) */}
        <div className="lg:hidden px-3 sm:px-6 pb-2">
          <div className="grid grid-cols-3 rounded-lg border border-border bg-background/60 p-0.5">
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
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      <main className="grid gap-px bg-border grid-cols-1 lg:[grid-template-columns:minmax(280px,320px)_1fr_minmax(260px,300px)]">
        {/* LEFT: Controls */}
        <section
          className={`bg-background p-4 sm:p-5 space-y-3.5 ${mobileTab === "controls" ? "" : "hidden"} lg:block lg:h-[calc(100dvh-7.25rem)] lg:overflow-y-auto`}
        >
          <SectionLabel>Connection</SectionLabel>

          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground">Active Account</span>
            {accounts.length > 1 ? (
              <Select value={activeAccount.account_id} onValueChange={switchAccount}>
                <SelectTrigger className={`h-9 font-mono text-sm font-medium w-full bg-input border-border focus:ring-1 focus:ring-ring ${activeAccount.account_type === 'real' ? 'bg-bear/10 text-bear border-bear/20' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>
                      {acc.account_id} — {acc.account_type === 'demo' ? 'Demo' : 'Real'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={`rounded-md border border-border px-3 py-2 font-mono text-sm font-medium ${activeAccount.account_type === 'real' ? 'bg-bear/10 text-bear border-bear/20' : 'bg-surface'}`}>
                {activeAccount.account_id} · {activeAccount.account_type === 'demo' ? 'Demo' : 'Real'}
              </div>
            )}
            {activeAccount.account_type === 'real' && (
              <div className="text-[11px] text-bear">
                Live trading uses real funds. Trade at your own risk.
              </div>
            )}
            <div className="flex gap-1 lg:hidden">
              {(['demo','real'] as const).map((t) => {
                const acc = accounts.find(a => a.account_type === t);
                const isActive = activeAccount.account_type === t;
                return (
                  <button
                    key={t}
                    disabled={!acc || isActive}
                    onClick={() => acc && switchAccount(acc.account_id)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? (t === 'real' ? 'bg-bear/15 border-bear/30 text-bear' : 'bg-primary/15 border-primary/30 text-primary')
                        : 'border-border text-muted-foreground hover:text-foreground disabled:opacity-40'
                    }`}
                  >
                    {t === 'demo' ? 'Demo' : 'Real'}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="btn-secondary w-full"
            onClick={() => connect()}
            disabled={!wsUrl || s?.connected}
          >
            {s?.authorized ? "Connected" : s?.connected ? "Authorizing..." : "Connect Bot"}
          </button>

          <Divider />
          <SectionLabel>Strategy</SectionLabel>
          <Field label="Mode">
            <Select 
              value={cfg.triggerMode} 
              onValueChange={(val) => setCfg({ ...cfg, triggerMode: val as TriggerMode })}
            >
              <SelectTrigger className="w-full bg-input border-border h-[34px] focus:ring-1 focus:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific digit</SelectItem>
                <SelectItem value="any">Any digit</SelectItem>
                <SelectItem value="xxxyyy">XXXYYY = Z</SelectItem>
                <SelectItem value="odd">Odd reps</SelectItem>
                <SelectItem value="even">Even reps</SelectItem>
                <SelectItem value="th_dpst">TH DPST Strtgy (combo)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <p className="text-[10px] text-muted-foreground/80 -mt-2">
            {cfg.triggerMode === "any"
              ? "Trades when any digit repeats N times in a row."
              : cfg.triggerMode === "xxxyyy"
                  ? "Detects XXX YYY pattern; predicts next digit differs from Y."
                  : cfg.triggerMode === "odd"
                    ? "Trades when an odd digit repeats N times."
                    : cfg.triggerMode === "even"
                      ? "Trades when an even digit repeats N times."
                      : cfg.triggerMode === "th_dpst"
                        ? "Runs one trade of each strategy in a random order per cycle, then repeats."
                        : "Trades when the target digit repeats N times."}
          </p>
          {(() => {
            const scope: Exclude<TriggerMode, "th_dpst">[] =
              cfg.triggerMode === "th_dpst"
                ? dpstModes
                : [cfg.triggerMode as Exclude<TriggerMode, "th_dpst">];
            if (!scope.length) return null;
            const waitModes = cfg.waitFailModes ?? [];
            const active = scope.filter((m) => waitModes.includes(m));
            const allOn = active.length === scope.length;
            const setWait = (next: Exclude<TriggerMode, "th_dpst">[]) =>
              setCfg({ ...cfg, waitFailModes: TH_DPST_ALL.filter((x) => next.includes(x)) });
            return (
              <div className="rounded-md border border-border bg-surface/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-tight">Wait for a failed cycle</span>
                  <button
                    type="button"
                    onClick={() =>
                      setWait(
                        allOn
                          ? waitModes.filter((m) => !scope.includes(m))
                          : [...waitModes, ...scope],
                      )
                    }
                    className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {allOn ? "Clear" : "All"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {scope.map((m) => {
                    const on = waitModes.includes(m);
                    const armed = !!s?.patternArmed?.[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setWait(on ? waitModes.filter((x) => x !== m) : [...waitModes, m])
                        }
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                          on
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors ${
                            on ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {on && (
                            <svg
                              viewBox="0 0 10 8"
                              className="h-2 w-2 stroke-primary-foreground"
                              fill="none"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 4.2 3.6 6.8 9 1.4" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1">{TH_DPST_LABELS[m]}</span>
                        {on && (
                          <span
                            className={`font-mono text-[9px] uppercase tracking-wider ${
                              armed ? "text-warn" : "text-muted-foreground"
                            }`}
                          >
                            {armed ? "Armed" : "Waiting"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
                  Skips the first trigger of a selected strategy, then trades on the next one. After a win it skips once again; after a loss it re-enters immediately.
                </p>
              </div>
            );

          })()}

          {cfg.triggerMode === "th_dpst" && (
            <div className="rounded-md border border-border bg-surface/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-tight">Strategies in cycle</span>
                <button
                  type="button"
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      thDpstModes:
                        dpstModes.length === TH_DPST_ALL.length ? ["specific"] : [...TH_DPST_ALL],
                    })
                  }
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {dpstModes.length === TH_DPST_ALL.length ? "Clear" : "All"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TH_DPST_ALL.map((m) => {
                  const on = dpstModes.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = on ? dpstModes.filter((x) => x !== m) : [...dpstModes, m];
                        if (!next.length) return;
                        setCfg({
                          ...cfg,
                          thDpstModes: TH_DPST_ALL.filter((x) => next.includes(x)),
                        });
                      }}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                        on
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors ${
                          on ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {on && (
                          <svg
                            viewBox="0 0 10 8"
                            className="h-2 w-2 stroke-primary-foreground"
                            fill="none"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 4.2 3.6 6.8 9 1.4" />
                          </svg>
                        )}
                      </span>
                      {TH_DPST_LABELS[m]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
                One trade per selected strategy, random order, then the cycle repeats.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(cfg.triggerMode === "specific" || (cfg.triggerMode === "th_dpst" && dpstModes.includes("specific"))) && (
              <Field label="Target Digit">
                <Select 
                  value={cfg.targetDigit.toString()} 
                  onValueChange={(val) => setCfg({ ...cfg, targetDigit: Number(val) })}
                >
                  <SelectTrigger className="w-full bg-input border-border h-[34px] focus:ring-1 focus:ring-ring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i.toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {/* Specific digit repetitions */}
            {(cfg.triggerMode === "specific" || (cfg.triggerMode === "th_dpst" && dpstModes.includes("specific"))) && (
              <Field label={cfg.triggerMode === "th_dpst" ? "Specific Reps" : "Repetitions"}>
                <NumInput
                  value={cfg.repetitionCount}
                  min={1}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, repetitionCount: Math.max(1, v) })}
                />
              </Field>
            )}
            {/* Any digit repetitions */}
            {(cfg.triggerMode === "any" || (cfg.triggerMode === "th_dpst" && dpstModes.includes("any"))) && (
              <Field label={cfg.triggerMode === "th_dpst" ? "Any Reps" : "Repetitions"}>
                <NumInput
                  value={cfg.anyRepetitions}
                  min={1}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, anyRepetitions: Math.max(1, v) })}
                />
              </Field>
            )}
            {/* Odd digit repetitions */}
            {(cfg.triggerMode === "odd" || (cfg.triggerMode === "th_dpst" && dpstModes.includes("odd"))) && (
              <Field label={cfg.triggerMode === "th_dpst" ? "Odd Reps" : "Repetitions"}>
                <NumInput
                  value={cfg.oddRepetitions}
                  min={1}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, oddRepetitions: Math.max(1, v) })}
                />
              </Field>
            )}
            {/* Even digit repetitions */}
            {(cfg.triggerMode === "even" || (cfg.triggerMode === "th_dpst" && dpstModes.includes("even"))) && (
              <Field label={cfg.triggerMode === "th_dpst" ? "Even Reps" : "Repetitions"}>
                <NumInput
                  value={cfg.evenRepetitions}
                  min={1}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, evenRepetitions: Math.max(1, v) })}
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




          {s?.error && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
              {s.error}
            </div>
          )}
        </section>

        {/* CENTER: Live tick + digit */}
        <section
          className={`bg-background p-4 sm:p-6 space-y-4 ${mobileTab === "live" ? "" : "hidden"} lg:block lg:h-[calc(100dvh-7.25rem)] lg:overflow-y-auto`}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel
              title="Last Digit"
              hint={`${cfg.symbol === "1HZ100V" ? "Volatility 100 Index" : cfg.symbol}`}
            >
              <div className="flex items-end justify-between gap-6">
                <div
                  key={s?.lastDigit ?? "—"}
                  className={`font-mono text-[clamp(64px,9vw,96px)] leading-none tracking-tight tick-pulse ${
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
                      : cfg.triggerMode === "xxxyyy"
                        ? "Pattern"
                        : "Streak"}
                  </div>
                  <div className="font-mono text-xl">
                    <span className={s && s.streak > 0 ? "text-warn" : ""}>{s?.streak ?? 0}</span>
                    <span className="text-muted-foreground">
                      {cfg.triggerMode === "xxxyyy"
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
                  <span className="text-xs text-muted-foreground">Waiting for ticks...</span>
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

          <div className="rounded-xl border border-border bg-surface/30 overflow-hidden">
            <div className="flex items-center gap-1 border-b border-border bg-surface/50 px-2 py-1.5">
              {(
                [
                  { id: "log", label: "Trade Log" },
                  { id: "history", label: "Session History" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFeedTab(id)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    feedTab === id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              {feedTab === "log" && (
                <span className="ml-auto pr-1 font-mono text-[11px] text-muted-foreground">
                  {s?.trades.length ?? 0} trade{(s?.trades.length ?? 0) === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="p-3 sm:p-4">
              {feedTab === "log" ? (
                s?.trades.length ? (
                  <div className="overflow-x-auto max-h-[38dvh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background text-xs uppercase tracking-wider text-muted-foreground">
                        <tr className="text-left">
                          <th className="py-2 pr-4 font-medium">Time</th>
                          <th className="py-2 pr-4 font-medium">Differ !=</th>
                          <th className="py-2 pr-4 font-medium">Mode</th>
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
                            <td className="py-2 pr-4 text-muted-foreground">{t.mode || "-"}</td>
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
                )
              ) : (
                <SessionHistory currentAccountId={activeAccount.account_id} />
              )}
            </div>
          </div>
        </section>


        {/* RIGHT: Stats */}
        <section
          className={`bg-background p-4 sm:p-5 space-y-3.5 ${mobileTab === "stats" ? "" : "hidden"} lg:block lg:h-[calc(100dvh-7.25rem)] lg:overflow-y-auto`}
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-center">
          <Row k="Status" v={statusLabel} />
          <Row k="Pending" v={s?.pendingTrade ? "yes" : "no"} />
          <Row
            k="Mode"
            v={
              cfg.triggerMode === "th_dpst"
                ? `Dpst (${s?.remainingCycle.length || 0} left)`
                : cfg.triggerMode === "any"
                  ? "Any digit"
                  : cfg.triggerMode === "xxxyyy"
                      ? "XXXYYY = Z"
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
              (cfg.triggerMode === "xxxyyy")
                ? "Pattern"
                : cfg.triggerMode === "any"
                  ? String(cfg.anyRepetitions)
                  : cfg.triggerMode === "odd"
                    ? String(cfg.oddRepetitions)
                    : cfg.triggerMode === "even"
                      ? String(cfg.evenRepetitions)
                      : String(cfg.repetitionCount)
            }
          />
          <Row
            k={
              cfg.triggerMode === "any" ||
              cfg.triggerMode === "odd" ||
              cfg.triggerMode === "even"
                ? `Reps waited (digit ${s?.streakDigit ?? "—"})`
                : cfg.triggerMode === "xxxyyy"
                  ? "Pattern streak"
                  : cfg.triggerMode === "th_dpst"
                    ? `Simultaneous Cycle`
                    : "Streak"
            }
            v={`${s?.streak ?? 0}`}
          />
          <Row k="Symbol" v="1HZ100V" />
          <Row k="Duration" v="1 tick" />
          </div>



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
          transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
        }
        .input:focus { border-color: var(--ring); box-shadow: 0 0 0 2px hsl(var(--ring) / .15); }
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
      <PwaInstallBanner />


    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-2">{children}</h2>;
}
function Divider() {
  return <hr className="border-border my-3" />;
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
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft !== null ? draft : (value || "")}
      min={min}
      step={step}
      onFocus={(e) => {
        setDraft("");
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? Math.max(min, n) : min);
        setDraft(null);
      }}
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
    <div className="flex flex-col items-start justify-center py-1 gap-0.5 text-xs overflow-hidden">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-medium truncate w-full" title={typeof v === "string" ? v : undefined}>{v}</span>
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

function formatDateTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Palette of HSL color strings, one for each digit (0-9).
// This ensures that repetitions of the same digit always have the same distinct color.
const DIGIT_COLORS = [
  "190 90% 55%",  // 0: cyan
  "38 92% 55%",   // 1: amber
  "142 70% 45%",  // 2: green
  "280 75% 65%",  // 3: violet
  "0 80% 62%",    // 4: red
  "210 90% 60%",  // 5: blue
  "50 95% 55%",   // 6: yellow
  "320 75% 60%",  // 7: pink
  "27 90% 55%",   // 8: orange
  "170 80% 45%",  // 9: teal
];

// digits[0] is most recent. Returns an array of same length with hsl color string or null per index.
function computeStreakHighlights(
  digits: number[],
  mode: TriggerMode,
  targetDigit: number,
  _reps: number,
): (string | null)[] {
  const out: (string | null)[] = digits.map(() => null);
  if (!digits.length) return out;

  // Pattern mode: highlight the last 6 ticks (indices 0..5) if they match XXXYYY.
  if (mode === "xxxyyy") {
    if (digits.length >= 6) {
      const [d0, d1, d2, d3, d4, d5] = digits;
      if (d0 === d1 && d1 === d2 && d3 === d4 && d4 === d5 && d0 !== d3) {
        const cA = DIGIT_COLORS[d0];
        const cB = DIGIT_COLORS[d3];
        out[0] = out[1] = out[2] = cA;
        out[3] = out[4] = out[5] = cB;
      }
    }
    return out;
  }

  // Highlight every consecutive same-digit run (length >= 2) with the digit's unique color.
  void mode;
  void targetDigit;
  let i = 0;
  while (i < digits.length) {
    let j = i;
    while (j < digits.length && digits[j] === digits[i]) j++;
    const runLen = j - i;
    if (runLen >= 2) {
      const color = DIGIT_COLORS[digits[i]];
      for (let k = i; k < j; k++) out[k] = color;
    }
    i = j;
  }
  return out;
}


