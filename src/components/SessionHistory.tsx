import React, { useEffect, useState } from "react";
import { Trash2, History } from "lucide-react";
import { Trade } from "@/lib/derivBot";

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
  trades?: Trade[];
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      <div className="grid grid-cols-4 gap-2 text-center auto-rows-fr">
        <TotalCell
          label="Net P/L"
          value={`${totals.pnl >= 0 ? "+" : ""}${totals.pnl.toFixed(2)}`}
          accent={totals.pnl >= 0 ? "bull" : "bear"}
        />
        <TotalCell label="Wins" value={String(totals.wins)} accent="bull" />
        <TotalCell label="Losses" value={String(totals.losses)} accent="bear" />
        <TotalCell label="Win %" value={`${winRate}%`} />
      </div>

      <div className="rounded-md border border-border bg-surface/40 max-h-[360px] overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No {tab} sessions saved yet. End & Save a session to see it here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const isCurrent = s.accountId === currentAccountId;
              const rate = s.totalTrades
                ? Math.round((s.wins / s.totalTrades) * 100)
                : 0;
              return (
                <React.Fragment key={s.id}>
                  <li className="p-2.5 flex items-center gap-2 font-mono text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{fmtDate(s.endedAt)}</span>
                        <span>·</span>
                        <span>{fmtDuration(s.endedAt - s.startedAt)}</span>
                        {isCurrent && <span className="text-primary">•</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-foreground">{s.totalTrades} trades</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-bull">{s.wins}W</span>
                        <span className="text-bear">{s.losses}L</span>
                        <span className="text-muted-foreground">({rate}%)</span>
                      </div>
                    </div>
                    <div className={`text-right font-semibold ${s.pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {s.pnl >= 0 ? "+" : ""}
                      {s.pnl.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.trades && s.trades.length > 0 && (
                        <button
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {expandedId === s.id ? "Hide" : "View"}
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="p-1 text-muted-foreground hover:text-bear transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                  {expandedId === s.id && s.trades && (
                    <li className="px-2.5 pb-2.5">
                      <div className="bg-surface rounded border border-border p-2 overflow-x-auto">
                        <table className="w-full text-xs font-mono text-left">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="font-normal pr-2">Mode</th>
                              <th className="font-normal pr-2">Digit</th>
                              <th className="font-normal pr-2 text-right">P/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.trades.map((t) => (
                              <tr key={t.id} className="border-t border-border/50">
                                <td className="pr-2 py-1 text-muted-foreground">{t.mode || "-"}</td>
                                <td className="pr-2 py-1">{t.digit}</td>
                                <td className={`py-1 text-right ${t.profit && t.profit > 0 ? "text-bull" : "text-bear"}`}>
                                  {t.profit ? (t.profit > 0 ? `+${t.profit.toFixed(2)}` : t.profit.toFixed(2)) : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </li>
                  )}
                </React.Fragment>
              );
            })}
          </ul>
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
    <div className="rounded-md border border-border bg-surface-2/60 p-2 min-w-0 min-h-[54px] flex flex-col justify-center h-full">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</div>
      <div
        className={`font-mono text-xs sm:text-sm font-semibold leading-tight break-words ${
          accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
