import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, RefreshCw } from "lucide-react";

export type SessionRow = {
  id: string;
  account_type: string;
  pnl: number;
  wins: number;
  losses: number;
  total_trades: number;
  stake: number | null;
  target_digit: number | null;
  repetition_count: number | null;
  started_at: string;
  ended_at: string;
};

export function SessionHistory({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("trading_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("ended_at", { ascending: false })
      .limit(50);
    setRows((data as SessionRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [userId, refreshKey]);

  async function remove(id: string) {
    await supabase.from("trading_sessions").delete().eq("id", id);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.pnl += Number(r.pnl);
      acc.wins += r.wins;
      acc.losses += r.losses;
      acc.trades += r.total_trades;
      return acc;
    },
    { pnl: 0, wins: 0, losses: 0, trades: 0 },
  );
  const overallWinRate = totals.trades ? Math.round((totals.wins / totals.trades) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold tracking-tight">Session History</h3>
        <button
          onClick={load}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> {loading ? "…" : "Refresh"}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Tot label="Sessions" v={String(rows.length)} />
        <Tot
          label="Net P/L"
          v={`${totals.pnl >= 0 ? "+" : ""}${totals.pnl.toFixed(2)}`}
          accent={totals.pnl >= 0 ? "bull" : "bear"}
        />
        <Tot label="Trades" v={String(totals.trades)} />
        <Tot label="Win rate" v={`${overallWinRate}%`} />
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center py-8 text-xs text-muted-foreground">
          No saved sessions yet. End a session to log it here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3 font-medium">Ended</th>
                <th className="py-2 pr-3 font-medium">Acct</th>
                <th className="py-2 pr-3 font-medium">Trades</th>
                <th className="py-2 pr-3 font-medium">W/L</th>
                <th className="py-2 pr-3 font-medium">Win%</th>
                <th className="py-2 pr-3 font-medium">Reps</th>
                <th className="py-2 pr-3 font-medium text-right">P/L</th>
                <th className="py-2 pr-0 font-medium" />
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => {
                const wr = r.total_trades ? Math.round((r.wins / r.total_trades) * 100) : 0;
                const pnl = Number(r.pnl);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(r.ended_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={r.account_type === "real" ? "text-bear" : "text-primary"}>
                        {r.account_type}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{r.total_trades}</td>
                    <td className="py-2 pr-3">
                      <span className="text-bull">{r.wins}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-bear">{r.losses}</span>
                    </td>
                    <td className="py-2 pr-3">{wr}%</td>
                    <td className="py-2 pr-3">{r.repetition_count ?? 0}</td>
                    <td className={`py-2 pr-3 text-right ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <button
                        onClick={() => remove(r.id)}
                        className="text-muted-foreground hover:text-bear"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tot({ label, v, accent }: { label: string; v: string; accent?: "bull" | "bear" }) {
  const color =
    accent === "bull" ? "text-bull" : accent === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-md bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm ${color}`}>{v}</div>
    </div>
  );
}
