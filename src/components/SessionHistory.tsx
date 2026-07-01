import { useEffect, useState } from "react";
import { Trash2, History } from "lucide-react";

export type SavedSession = {
  id: string;
  accountId: string;
  accountType: "demo" | "real";
  startedAt: number;
  endedAt: number;
  pnl: number;
  wins: number;
  losses: number;
  totalTrades: number;
  stake: number;
  triggerMode: string;
  targetDigit: number;
  repetitionCount: number;
  currency: string;
};

const STORAGE_KEY = "smrttrdr.sessions.v1";

export function loadSessions(): SavedSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(s: SavedSession) {
  const all = loadSessions();
  all.unshift(s);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
  window.dispatchEvent(new CustomEvent("smrttrdr:sessions-changed"));
}

export function deleteSession(id: string) {
  const all = loadSessions().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("smrttrdr:sessions-changed"));
}

export function clearSessions(accountType?: "demo" | "real") {
  if (!accountType) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const all = loadSessions().filter((x) => x.accountType !== accountType);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  window.dispatchEvent(new CustomEvent("smrttrdr:sessions-changed"));
}

function fmtDate(t: number) {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function SessionHistory({ currentAccountId }: { currentAccountId?: string }) {
  const [sessions, setSessions] = useState<SavedSession[]>(() => loadSessions());
  const [tab, setTab] = useState<"demo" | "real">("demo");

  useEffect(() => {
    const handler = () => setSessions(loadSessions());
    window.addEventListener("smrttrdr:sessions-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("smrttrdr:sessions-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const filtered = sessions.filter((s) => s.accountType === tab);
  const totals = filtered.reduce(
    (acc, s) => {
      acc.pnl += s.pnl;
      acc.wins += s.wins;
      acc.losses += s.losses;
      acc.trades += s.totalTrades;
      return acc;
    },
    { pnl: 0, wins: 0, losses: 0, trades: 0 },
  );
  const winRate = totals.trades ? Math.round((totals.wins / totals.trades) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider">Session History</h2>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-mono">
          {(["demo", "real"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "demo" ? "Demo" : "Real"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <TotalCell
          label="Net P/L"
          value={`${totals.pnl >= 0 ? "+" : ""}${totals.pnl.toFixed(2)}`}
          accent={totals.pnl >= 0 ? "bull" : "bear"}
        />
        <TotalCell label="Wins" value={String(totals.wins)} accent="bull" />
        <TotalCell label="Losses" value={String(totals.losses)} accent="bear" />
        <TotalCell label="Win %" value={`${winRate}%`} />
      </div>

      <div className="rounded-md border border-border bg-surface/40 max-h-[360px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No {tab} sessions saved yet. End & Save a session to see it here.
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2/60 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Date</th>
                <th className="px-2 py-2 text-left font-medium">Dur</th>
                <th className="px-2 py-2 text-right font-medium">Trades</th>
                <th className="px-2 py-2 text-right font-medium">W/L</th>
                <th className="px-2 py-2 text-right font-medium">P/L</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const isCurrent = s.accountId === currentAccountId;
                const rate = s.totalTrades
                  ? Math.round((s.wins / s.totalTrades) * 100)
                  : 0;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(s.endedAt)}
                      {isCurrent && (
                        <span className="ml-1 text-primary text-[9px]">•</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDuration(s.endedAt - s.startedAt)}
                    </td>
                    <td className="px-2 py-2 text-right">{s.totalTrades}</td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-bull">{s.wins}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-bear">{s.losses}</span>
                      <span className="text-muted-foreground"> ({rate}%)</span>
                    </td>
                    <td
                      className={`px-2 py-2 text-right ${s.pnl >= 0 ? "text-bull" : "text-bear"}`}
                    >
                      {s.pnl >= 0 ? "+" : ""}
                      {s.pnl.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="text-muted-foreground hover:text-bear transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <button
          onClick={() => {
            if (confirm(`Clear all ${tab} session history?`)) clearSessions(tab);
          }}
          className="text-[11px] text-muted-foreground hover:text-bear transition-colors"
        >
          Clear {tab} history
        </button>
      )}
    </div>
  );
}

function TotalCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "bull" | "bear";
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2/60 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-sm font-semibold ${
          accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
