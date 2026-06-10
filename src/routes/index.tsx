import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDerivBot } from "@/hooks/useDerivBot";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { AuthScreen } from "@/components/AuthScreen";
import { Footer } from "@/components/Footer";
import { SessionHistory } from "@/components/SessionHistory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { exchangeDerivCode, buildDerivAuthUrl, generatePkce } from "@/lib/derivOAuth.functions";
import type { TriggerMode } from "@/lib/derivBot";


// Deriv classic OAuth flow: redirect to oauth.deriv.com/oauth2/authorize and
// Deriv redirects back with ?acct1=...&token1=...&cur1=... directly.
const DERIV_REDIRECT_URI = "https://thdpstdgtdffrs.vercel.app/";
import {
  LogOut,
  Save,
  Archive,
  Sun,
  Moon,
  Settings,
  Activity,
  BarChart3,
  History,
  Bell,
  BellOff,
} from "lucide-react";

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

// Strip surrounding whitespace, any "Bearer " prefix, BOM/zero-width chars,
// and any internal whitespace/control chars. Deriv's newer long API tokens
// (JWT-style, often 60+ chars with dots/dashes/underscores) are otherwise
// passed through unchanged so they work alongside the legacy 15-char tokens.
function sanitizeToken(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^\s*bearer\s+/i, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\s\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

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
  const [tokenLoadError, setTokenLoadError] = useState<string | null>(null);
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

  // ---------- Trade notifications (Web Push -> all of this user's devices) ----------
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
  );
  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  const seenTradesRef = useRef<Set<string>>(new Set());
  // Seed seen set with any open trades that already exist so we don't spam on mount
  useEffect(() => {
    if (!s?.trades) return;
    for (const t of s.trades) {
      if (t.status !== "open" && !seenTradesRef.current.has(t.id)) {
        seenTradesRef.current.add(t.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function urlBase64ToUint8Array(base64: string) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function ensurePushSubscription() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { data: vapid, error: vErr } = await supabase.functions.invoke("push", {
          body: { action: "vapid" },
        });
        if (vErr || !vapid?.publicKey) throw vErr ?? new Error("No VAPID key");
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await supabase.functions.invoke("push", {
        body: {
          action: "subscribe",
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
    } catch (e) {
      console.warn("Push subscription failed", e);
    }
  }

  async function sendPushSafe(payload: {
    title: string;
    body: string;
    tag?: string;
    requireInteraction?: boolean;
    vibrate?: number[];
  }) {
    try {
      await supabase.functions.invoke("push", {
        body: { action: "send", ...payload },
      });
    } catch (e) {
      console.warn("Push send failed", e);
    }
  }

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
      void sendPushSafe({
        title,
        body,
        tag: `trade-${t.id}`,
        vibrate: won ? [80, 40, 80] : [200],
      });
    }
  }, [s?.trades, notifPerm, notifSupported, s?.currency, s?.pnl]);

  async function requestNotifications() {
    if (!notifSupported) return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      if (p === "granted") {
        await ensurePushSubscription();
        void sendPushSafe({
          title: "Notifications enabled",
          body: "You'll get alerts on every signed-in device.",
          tag: "enabled",
        });
      }
    } catch {
      // ignore
    }
  }

  // Re-attach subscription on load if permission is already granted (covers new devices)
  useEffect(() => {
    if (notifPerm === "granted") void ensurePushSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPerm]);

  // Notify on Stop Loss / Take Profit trigger (bot sets state.error with these labels)
  const lastRiskErrRef = useRef<string | null>(null);
  useEffect(() => {
    const err = s?.error ?? null;
    if (!err || err === lastRiskErrRef.current) return;
    const isSL = err.startsWith("Stop Loss hit");
    const isTP = err.startsWith("Take Profit reached");
    if (!isSL && !isTP) return;
    lastRiskErrRef.current = err;
    if (!notifSupported || notifPerm !== "granted") return;
    const title = isTP ? "🎯 Take Profit reached" : "🛑 Stop Loss hit";
    const body = `${err} · Session ended · ${s?.wins ?? 0}W / ${s?.losses ?? 0}L`;
    void sendPushSafe({
      title,
      body,
      tag: `risk-${Date.now()}`,
      requireInteraction: true,
      vibrate: isTP ? [80, 40, 80, 40, 200] : [300, 100, 300],
    });
  }, [s?.error, notifPerm, notifSupported, s?.wins, s?.losses]);

  const digits = useMemo(() => s?.ticks.slice(0, 30).map((t) => t.digit) ?? [], [s?.ticks]); // Load tokens + preferred account type from this signed-in user's profile.

  // Assigns a group index to each digit that's part of a same-digit streak (length ≥ 2).
  // Consecutive streaks of different digits get different group ids so they can be styled
  // distinctly (e.g. 0 0 4 4 1 1 → groups 0, 0, 1, 1, 2, 2). Non-streak digits get -1.
  const computeStreakGroups = (vals: number[]): number[] => {
    const out: number[] = new Array(vals.length).fill(-1);
    let g = -1;
    for (let i = 0; i < vals.length; i++) {
      const inStreak = vals[i] === vals[i - 1] || vals[i] === vals[i + 1];
      if (!inStreak) continue;
      if (i === 0 || vals[i] !== vals[i - 1]) g++;
      out[i] = g;
    }
    return out;
  };
  useEffect(() => {
    if (!user) {
      setTokenLoaded(false);
      setTokenLoadError(null);
      setDemoToken("");
      setRealToken("");
      return;
    }

    // Deriv OAuth returns one or more accounts as acct1/token1/cur1,
    // acct2/token2/cur2, ... so we capture both Demo (VRTC*) and Real
    // tokens in a single round-trip.
    const params = new URLSearchParams(window.location.search);
    const oauthAccounts: { acct: string; token: string }[] = [];
    for (let i = 1; i < 20; i++) {
      const acct = params.get(`acct${i}`);
      const token = params.get(`token${i}`);
      if (!acct || !token) break;
      oauthAccounts.push({ acct, token });
    }

    // PKCE OAuth (new Deriv API) returns ?code=...&state=...
    const pkceCode = params.get("code");
    const pkceState = params.get("state");
    const pkceError = params.get("error");

    let cancelled = false;
    (async () => {
      setTokenLoaded(false);
      setTokenLoadError(null);

      if (pkceError) {
        setTokenLoadError(`Deriv sign-in cancelled: ${pkceError}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (pkceCode && pkceState) {
        const storedState = sessionStorage.getItem("deriv_oauth_state");
        const verifier = sessionStorage.getItem("deriv_pkce_verifier");
        sessionStorage.removeItem("deriv_oauth_state");
        sessionStorage.removeItem("deriv_pkce_verifier");
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!storedState || storedState !== pkceState || !verifier) {
          setTokenLoadError("OAuth state mismatch — please try signing in again.");
        } else {
          try {
            const tokenRes = await exchangeDerivCode({
              code: pkceCode,
              code_verifier: verifier,
              redirect_uri: DERIV_REDIRECT_URI,
            });

            const expiresAt = new Date(
              Date.now() + (tokenRes.expires_in - 30) * 1000,
            ).toISOString();
            const { error: oerr } = await supabase.from("profiles").upsert({
              id: user.id,
              email: user.email ?? null,
              deriv_oauth_token: tokenRes.access_token,
              deriv_oauth_expires_at: expiresAt,
            });
            if (oerr) console.error("OAuth token save failed:", oerr);
            setSavedMsg("Signed in with Deriv");
            setTimeout(() => setSavedMsg(null), 3000);
          } catch (e: any) {
            console.error("Deriv token exchange failed:", e);
            setTokenLoadError(
              `Deriv token exchange failed: ${e?.message ?? "unknown error"}`,
            );
          }
        }
      } else if (oauthAccounts.length > 0) {
        let demoTok = "";
        let realTok = "";
        for (const a of oauthAccounts) {
          if (a.acct.startsWith("VRTC")) demoTok = a.token;
          else realTok = a.token;
        }
        const preferred: "demo" | "real" = realTok ? "real" : "demo";
        if (demoTok) setDemoToken(demoTok);
        if (realTok) setRealToken(realTok);
        setAccountType(preferred);

        const patch: Record<string, string> = { account_type: preferred };
        if (demoTok) patch.deriv_token_demo = demoTok;
        if (realTok) patch.deriv_token_real = realTok;

        const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email ?? null,
          ...patch,
        });
        if (upsertErr) console.error("OAuth token save failed:", upsertErr);

        window.history.replaceState({}, document.title, window.location.pathname);
        setSavedMsg(
          `Connected ${oauthAccounts.length} Deriv account${oauthAccounts.length > 1 ? "s" : ""} via OAuth`,
        );
        setTimeout(() => setSavedMsg(null), 3000);
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "email, deriv_token, deriv_token_demo, deriv_token_real, account_type, deriv_oauth_token, deriv_oauth_expires_at",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Profile token load failed:", error);
        setDemoToken("");
        setRealToken("");
        setTokenLoadError("Saved token could not be loaded. Please try signing out and back in.");
        setTokenLoaded(true);
        return;
      }
      const dt = data?.deriv_token_demo ?? data?.deriv_token ?? "";
      const rt = data?.deriv_token_real ?? "";
      const at = (data?.account_type === "real" ? "real" : "demo") as "demo" | "real";

      // Only use the OAuth token if it hasn't expired.
      const oauthExp = data?.deriv_oauth_expires_at
        ? new Date(data.deriv_oauth_expires_at).getTime()
        : 0;
      const oauthValid = oauthExp > Date.now() + 10_000;
      const oauthTok = oauthValid ? (data?.deriv_oauth_token ?? "") : "";

      setDemoToken(dt);
      setRealToken(rt);
      setAccountType(at);
      setCfg((c) => ({
        ...c,
        token: at === "real" ? rt : dt,
        accessToken: oauthTok,
        accountType: at,
      }));
      setTokenLoaded(true);


      // Older accounts may not have a profile row yet; create one scoped to this user.
      if (!data) {
        const { error: createError } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email ?? null,
          account_type: at,
        });
        if (createError && !cancelled) {
          console.error("Profile creation failed:", createError);
          setTokenLoadError(
            "Your profile was created late, but token saving is not ready yet. Refresh and try again.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
    setCfg({ ...cfg, token: tok, accountType: next });
    if (user) {
      supabase.from("profiles").update({ account_type: next }).eq("id", user.id);
    }
  }

  async function persistActiveToken() {
    if (!user) return;
    const token = accountType === "real" ? realToken.trim() : demoToken.trim();
    const patch =
      accountType === "real" ? { deriv_token_real: token } : { deriv_token_demo: token };
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      account_type: accountType,
      ...patch,
    });
    if (error) throw error;
  }

  async function saveToken() {
    if (!user) return;
    setSavingToken(true);
    setSavedMsg(null);
    const error = await persistActiveToken()
      .then(() => null)
      .catch((e) => e as Error);
    setSavingToken(false);
    if (error) {
      console.error("Token save failed:", error);
      setSavedMsg("Save failed — refresh and try again");
    } else {
      setCfg({ ...cfg, token: activeToken });
      setSavedMsg(`${accountType === "real" ? "Real" : "Demo"} token saved`);
      setTimeout(() => setSavedMsg(null), 2000);
    }
  }

  async function connectWithSavedToken() {
    if (!activeToken) return;
    setSavingToken(true);
    setSavedMsg(null);
    const error = await persistActiveToken()
      .then(() => null)
      .catch((e) => e as Error);
    setSavingToken(false);
    if (error) {
      console.error("Token save before connect failed:", error);
      setSavedMsg("Save failed — refresh and try again");
      return;
    }
    setCfg({ ...cfg, token: activeToken });
    connect();
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
  const statusLabel = !s?.connected
    ? "Disconnected"
    : s?.running
      ? "Running"
      : s?.authorized
        ? "Idle"
        : "Connecting…";

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
            <div>
              Switching to <b>Real</b> will trade with real money. Confirm?
            </div>
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

      <div className="space-y-2">
        <button
          className="btn-primary w-full"
          onClick={async () => {
            try {
              const { verifier, challenge, state } = await generatePkce();
              sessionStorage.setItem("deriv_pkce_verifier", verifier);
              sessionStorage.setItem("deriv_oauth_state", state);
              const url = buildDerivAuthUrl({
                redirect_uri: DERIV_REDIRECT_URI,
                code_challenge: challenge,
                state,
              });
              window.location.href = url;
            } catch (e) {
              console.error("Deriv OAuth init failed:", e);
            }
          }}
        >
          Sign in with Deriv (OAuth)
        </button>
        <p className="text-[10.5px] text-muted-foreground leading-snug">
          Redirects to Deriv to grant access. The redirect URL registered with
          your Deriv app must be exactly{" "}
          <code className="font-mono text-[10px]">{DERIV_REDIRECT_URI}</code>.
          Sign-in only works from that URL.
        </p>
      </div>


      <Divider />
      <SectionLabel>Manual Token (optional)</SectionLabel>
      <Field label={`${accountType === "real" ? "Real" : "Demo"} API Token`}>
        <input
          type="text"
          value={accountType === "real" ? realToken : demoToken}
          onChange={(e) => {
            const v = sanitizeToken(e.target.value);
            if (accountType === "real") setRealToken(v);
            else setDemoToken(v);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const v = sanitizeToken(e.clipboardData.getData("text") || "");
            if (accountType === "real") setRealToken(v);
            else setDemoToken(v);
          }}
          placeholder={tokenLoaded ? `Paste ${accountType} API token` : "Loading…"}
          className="input font-mono"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name={`deriv-${accountType}-token`}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-secondary inline-flex items-center justify-center gap-1.5"
          onClick={saveToken}
          disabled={savingToken || !activeToken}
          title="Save manual token"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          className="btn-secondary"
          onClick={connectWithSavedToken}
          disabled={!activeToken || s?.connected || savingToken}
        >
          {s?.authorized ? "Connected" : s?.connected ? "Authorizing..." : "Connect"}
        </button>
      </div>
      {savedMsg && <div className="text-[11px] text-muted-foreground">{savedMsg}</div>}
      {tokenLoaded && !tokenLoadError && !activeToken && (
        <div className="text-[11px] text-muted-foreground">
          No saved {accountType} token yet — use OAuth above or paste one manually.
        </div>
      )}
      {tokenLoadError && (
        <div className="rounded-md border border-bear/40 bg-bear/10 px-2.5 py-1.5 text-[11px] text-bear">
          {tokenLoadError}
        </div>
      )}

      <Divider />
      <SectionLabel>Strategy</SectionLabel>

      <div className="space-y-1.5">
        <span className="text-[11px] text-muted-foreground">Trigger Mode</span>
        <Select
          value={cfg.triggerMode ?? "specific"}
          onValueChange={(v: string) => setCfg({ ...cfg, triggerMode: v as TriggerMode })}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="specific">Specific digit</SelectItem>
            <SelectItem value="any">Any digit</SelectItem>
            <SelectItem value="xxyyy">XXYYY = Z</SelectItem>
            <SelectItem value="odd">Odd reps</SelectItem>
            <SelectItem value="even">Even reps</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10.5px] text-muted-foreground leading-snug">
          {cfg.triggerMode === "any"
            ? "Trades when any digit repeats N times in a row. Trade is placed against the digit that triggered."
            : cfg.triggerMode === "xxyyy"
            ? "Detects the pattern XX YYY (one digit repeats twice, then a different digit repeats three times). Predicts the next digit will differ from Y."
            : cfg.triggerMode === "odd"
            ? "Trades when an odd digit (1,3,5,7,9) repeats N times in a row. Placed against the triggering digit."
            : cfg.triggerMode === "even"
            ? "Trades when an even digit (0,2,4,6,8) repeats N times in a row. Placed against the triggering digit."
            : "Trades only when the chosen target digit repeats N times in a row."}
        </p>
      </div>

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
        {cfg.triggerMode !== "xxyyy" && (
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
        <Panel
          title="Last Digit"
          hint={`${cfg.symbol === "R_100" ? "Volatility 100 Index" : cfg.symbol}`}
        >
          <div className="flex items-end justify-between gap-4">
            <div
              key={s?.lastDigit ?? "—"}
              className={`font-mono text-[80px] sm:text-[112px] leading-none tracking-tight tick-pulse ${
                (() => {
                  const isStreak =
                    s?.lastDigit != null &&
                    s?.ticks?.[1]?.digit === s?.lastDigit &&
                    (cfg.triggerMode === "any" || s?.lastDigit === cfg.targetDigit);
                  return isStreak ? "text-primary digit-glow" : "text-foreground";
                })()
              }`}
            >
              {s?.lastDigit ?? "—"}
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Price</div>
              <div className="font-mono text-xl">{s?.lastPrice?.toFixed(2) ?? "—"}</div>
              <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                Streak
              </div>
              <div className="font-mono text-xl">
                <span className={s && s.streak > 0 ? "text-warn" : ""}>{s?.streak ?? 0}</span>
                <span className="text-muted-foreground"> / {cfg.repetitionCount}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {(() => {
              const isAny = cfg.triggerMode !== "specific";
              const groups = computeStreakGroups(digits);
              const styles = [
                "bg-primary/15 text-primary",
                "bg-warn/15 text-warn",
                "bg-bull/15 text-bull",
                "bg-bear/15 text-bear",
              ];
              return digits.map((d, i) => {
                const g = groups[i];
                const inStreak = g >= 0;
                const highlight = isAny ? inStreak : d === cfg.targetDigit;
                const cls = highlight
                  ? isAny
                    ? styles[g % styles.length]
                    : "bg-primary/15 text-primary"
                  : "bg-surface text-muted-foreground";
                return (
                  <span
                    key={i}
                    className={`font-mono text-xs h-7 w-7 grid place-items-center rounded ${cls}`}
                  >
                    {d}
                  </span>
                );
              });
            })()}
            {digits.length === 0 && (
              <span className="text-xs text-muted-foreground">Waiting for ticks…</span>
            )}
          </div>
        </Panel>

        <Panel title="Tick Stream">
          <div className="h-[260px] overflow-hidden font-mono text-xs">
            {s?.ticks.length ? (
              <ul className="space-y-1">
                {(() => {
                  const visible = s.ticks.slice(0, 14);
                  const isAny = cfg.triggerMode === "any";
                  const groups = computeStreakGroups(visible.map((t) => t.digit));
                  const colors = [
                    "text-primary",
                    "text-warn",
                    "text-bull",
                    "text-bear",
                  ];
                  return visible.map((t, i) => {
                    const g = groups[i];
                    const inStreak = g >= 0;
                    const highlight = isAny ? inStreak : t.digit === cfg.targetDigit;
                    const color = highlight
                      ? isAny
                        ? colors[g % colors.length]
                        : "text-primary"
                      : "";
                    return (
                      <li key={t.time + "-" + i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {new Date(t.time).toLocaleTimeString([], { hour12: false })}
                        </span>
                        <span>{t.price.toFixed(2)}</span>
                        <span className={color}>·{t.digit}</span>
                      </li>
                    );
                  });
                })()}
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
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(t.time).toLocaleTimeString([], { hour12: false })}
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
        <div
          className={`font-mono text-4xl tracking-tight ${pnlAnim >= 0 ? "text-bull" : "text-bear"}`}
        >
          {pnlAnim >= 0 ? "+" : ""}
          {pnlAnim.toFixed(2)}
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
      <Row k="Reps waited" v={`${cfg.repetitionCount}`} />
      <Row k="Streak" v={`${s?.streak ?? 0} / ${cfg.repetitionCount}`} />
      <Row k="Symbol" v="R_100" />
      <Row k="Duration" v="1 tick" />

      <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Demo and Real tokens are saved separately and are only loaded for your signed-in account.
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
            ThDpstSmrtTrdr
            <span className="hidden sm:inline text-muted-foreground"> · Digits Differ</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`status-dot inline-block h-2 w-2 rounded-full ${statusColor}`}
              style={{ backgroundColor: "currentColor" }}
            />
            <span className={statusColor}>{statusLabel}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            <span className="hidden sm:inline">{s?.currency} </span>
            <span className="text-foreground">
              {s?.balance != null ? s.balance.toFixed(2) : "—"}
            </span>
          </div>
          <div className="hidden md:block text-muted-foreground font-mono max-w-[160px] truncate">
            {user.email}
          </div>
          {notifSupported && (
            <button
              onClick={requestNotifications}
              disabled={notifPerm === "denied"}
              className="inline-flex items-center justify-center rounded-md border border-border h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                notifPerm === "granted"
                  ? "Trade notifications enabled"
                  : notifPerm === "denied"
                    ? "Notifications blocked — enable them in your browser settings"
                    : "Enable trade notifications"
              }
              aria-label="Toggle notifications"
            >
              {notifPerm === "granted" ? (
                <Bell className="h-3.5 w-3.5 text-bull" />
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
            <TabsTrigger value="controls" className="text-xs gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              <span className="inline">Controls</span>
            </TabsTrigger>
            <TabsTrigger value="live" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="inline">Live</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span className="inline">History</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="controls" className="mt-0">
            {ControlsPanel}
          </TabsContent>
          <TabsContent value="live" className="mt-0">
            {LivePanel}
          </TabsContent>
          <TabsContent value="stats" className="mt-0">
            {StatsPanel}
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            {HistoryPanel}
          </TabsContent>
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function NumInput({
  value,
  onChange,
  min,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  const [text, setText] = useState<string>(String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(String(value));
  }, [value]);

  return (
    <input
      type="number"
      className="input"
      value={text}
      min={min}
      step={step}
      onFocus={(e) => {
        focusedRef.current = true;
        setText("");
        e.target.select();
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (text === "" || isNaN(Number(text))) {
          setText(String(value));
        } else {
          const n = Number(text);
          onChange(n);
          setText(String(n));
        }
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value !== "" && !isNaN(Number(e.target.value))) {
          onChange(Number(e.target.value));
        }
      }}
    />
  );
}
function Divider() {
  return <div className="h-px bg-border" />;
}
function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
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
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "bull" | "bear";
}) {
  const color =
    accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-foreground";
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
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid place-items-center py-8 text-xs text-muted-foreground">{children}</div>
  );
}
