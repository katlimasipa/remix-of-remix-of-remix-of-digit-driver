// Browser-side Deriv WebSocket bot — Digits Differ on Volatility 100
// Uses OAuth WebSocket URL with OTP from @deriv/core.

export type TriggerMode = "specific" | "any" | "xxyyy" | "xxxyy" | "odd" | "even" | "th_dpst";

// TH DPST Strtgy cycles through these six sub-strategies, one trade per step,
// then loops back to the beginning until stop-loss / take-profit / manual stop.
const TH_DPST_CYCLE: Exclude<TriggerMode, "th_dpst">[] = [
  "specific",
  "any",
  "xxyyy",
  "xxxyy",
  "odd",
  "even",
];

export type BotConfig = {
  wsUrl: string | undefined;
  token: string;
  symbol: string;
  stake: number;
  targetDigit: number;
  repetitionCount: number;
  anyRepetitions: number;
  oddRepetitions: number;
  evenRepetitions: number;
  stopLoss: number;
  takeProfit: number;
  triggerMode: TriggerMode;
};

export type Trade = {
  id: string;
  time: number;
  digit: number;
  buyPrice: number;
  payout?: number;
  profit?: number;
  status: "open" | "won" | "lost";
  mode: TriggerMode;
};

export type BotState = {
  connected: boolean;
  running: boolean;
  authorized: boolean;
  balance: number | null;
  currency: string;
  lastDigit: number | null;
  lastPrice: number | null;
  streak: number;
  streakDigit: number | null;
  ticks: { price: number; digit: number; time: number }[];
  trades: Trade[];
  pnl: number;
  wins: number;
  losses: number;
  totalTrades: number;
  error: string | null;
  pendingTrade: boolean;
  remainingCycle: Exclude<TriggerMode, "th_dpst">[];
};

export type BotEvent =
  | { type: "trade_settled"; trade: Trade; pnl: number }
  | { type: "stop_loss"; pnl: number }
  | { type: "take_profit"; pnl: number }
  | { type: "bot_started" }
  | { type: "bot_stopped"; reason: "manual" | "stop_loss" | "take_profit" };

type Listener = (s: BotState) => void;
type EventListener = (e: BotEvent) => void;

const SYMBOL = "1HZ100V";

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class DerivBot {
  private ws: WebSocket | null = null;
  private cfg: BotConfig;
  private listeners: Set<Listener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private state: BotState = {
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
    remainingCycle: [...TH_DPST_CYCLE],
  };
  private reqId = 1;
  private pending = new Map<number, (msg: any) => void>();
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private cooldown = 0;
  private streakDigit: number | null = null;
  private watchedContracts = new Set<string>();
  private settledContracts = new Set<string>();
  private wasAuthorized = false;
  private intentionalDisconnect = true;
  private reconnectAttempts = 0;

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  constructor(cfg: BotConfig) {
    this.cfg = cfg;
    if (cfg.triggerMode === "th_dpst") {
      this.state.remainingCycle = this.shuffleArray(TH_DPST_CYCLE);
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  onEvent(fn: EventListener) {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  private fire(e: BotEvent) {
    this.eventListeners.forEach((l) => {
      try {
        l(e);
      } catch {
        /* ignore */
      }
    });
  }

  private emit() {
    const snap = {
      ...this.state,
      ticks: this.state.ticks.slice(),
      trades: this.state.trades.slice(),
    };
    this.listeners.forEach((l) => l(snap));
  }

  private patch(p: Partial<BotState>) {
    this.state = { ...this.state, ...p };
    this.emit();
  }

  updateConfig(p: Partial<BotConfig>) {
    const previousUrl = this.cfg.wsUrl;
    this.cfg = { ...this.cfg, ...p };
    if (
      p.wsUrl &&
      p.wsUrl !== previousUrl &&
      this.wasAuthorized &&
      !this.intentionalDisconnect &&
      (!this.ws || this.ws.readyState === WebSocket.CLOSED)
    ) {
      this.scheduleReconnect(0);
    }
  }

  connect(wsUrl?: string) {
    if (wsUrl) this.cfg = { ...this.cfg, wsUrl };
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    )
      return;
    if (!this.cfg.wsUrl) {
      this.patch({ error: "Missing WebSocket URL" });
      return;
    }
    this.intentionalDisconnect = false;
    this.patch({ error: null });
    const ws = new WebSocket(this.cfg.wsUrl);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.patch({ connected: true, authorized: true });
      this.wasAuthorized = true;
      this.reconnectAttempts = 0;
      this.send({ balance: 1, subscribe: 1 }).catch(() => {});
      this.send({ ticks: SYMBOL, subscribe: 1 }).catch(() => {});
      this.startHeartbeat();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        this.onMessage(JSON.parse(e.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.stopHeartbeat();
      this.ws = null;
      this.patch({ connected: false, authorized: false });
      // Auto-reconnect if we were previously connected (running OR just idle).
      if (this.wasAuthorized && !this.intentionalDisconnect) this.scheduleReconnect();
    };
    ws.onerror = () => {
      if (this.ws !== ws) return;
      if (this.wasAuthorized && !this.intentionalDisconnect) {
        this.patch({ error: null });
      } else {
        this.patch({ error: "WebSocket connection failed" });
      }
    };
  }

  async recoverConnection(wsUrl?: string) {
    if (wsUrl) this.cfg = { ...this.cfg, wsUrl };
    this.intentionalDisconnect = false;

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.forceReconnect();
      return;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) return;

    try {
      await this.send({ ping: 1 }, 3500);
    } catch {
      this.forceReconnect();
    }
  }

  private forceReconnect(wsUrl?: string) {
    if (wsUrl) this.cfg = { ...this.cfg, wsUrl };
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    const staleSocket = this.ws;
    this.ws = null;
    try {
      staleSocket?.close();
    } catch {
      /* ignore */
    }
    this.pending.clear();
    this.patch({ connected: false, authorized: false, error: null });
    this.connect();
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ ping: 1 }));
        } catch {
          /* ignore */
        }
      }
    }, 20_000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(delay?: number) {
    if (this.intentionalDisconnect) return;
    if (this.reconnectTimer) return;
    const reconnectDelay = delay ?? Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempts, 5));
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, reconnectDelay);
  }

  private send(payload: any, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WS not open"));
        return;
      }
      const req_id = this.reqId++;
      this.pending.set(req_id, resolve);
      this.ws.send(JSON.stringify({ ...payload, req_id }));
      setTimeout(() => {
        if (this.pending.has(req_id)) {
          this.pending.delete(req_id);
          reject(new Error("Request timeout"));
        }
      }, timeoutMs);
    });
  }

  private onMessage(msg: any) {
    if (msg.req_id && this.pending.has(msg.req_id)) {
      const fn = this.pending.get(msg.req_id)!;
      this.pending.delete(msg.req_id);
      fn(msg);
    }

    if (msg.error && !msg.req_id) {
      this.patch({ error: msg.error.message });
      if (msg.error.code === "InvalidToken") this.patch({ authorized: false });
    }

    if (msg.msg_type === "balance" && msg.balance) {
      this.patch({
        balance: asFiniteNumber(msg.balance.balance),
        currency: msg.balance.currency,
      });
    }

    if (msg.msg_type === "tick" && msg.tick) {
      const quote = asFiniteNumber(msg.tick.quote, NaN);
      if (Number.isFinite(quote)) this.handleTick(quote);
    }

    if (msg.msg_type === "proposal_open_contract" && msg.proposal_open_contract) {
      this.handleContractUpdate(msg.proposal_open_contract);
    }
  }

  private lastDigitOf(price: number): number {
    const s = price.toFixed(2);
    return parseInt(s[s.length - 1], 10);
  }

  private handleTick(price: number) {
    const digit = this.lastDigitOf(price);
    const tick = { price, digit, time: Date.now() };
    const ticks = [tick, ...this.state.ticks].slice(0, 60);

    // Universal streak: track consecutive runs of the same digit
    let streak = this.state.streak;
    if (this.streakDigit === digit) {
      streak += 1;
    } else {
      streak = 1;
      this.streakDigit = digit;
    }
    const streakDigit = digit;

    this.patch({ lastDigit: digit, lastPrice: price, ticks, streak, streakDigit });

    if (this.cooldown > 0) this.cooldown -= 1;

    // Pattern buffers for xxyyy / xxxyy
    let xxyyyTrigger = false;
    let xxyyyBarrier: number | null = null;
    let xxxyyTrigger = false;
    let xxxyyBarrier: number | null = null;

    if (this.state.ticks.length >= 5) {
      const t0 = this.state.ticks[0].digit;
      const t1 = this.state.ticks[1].digit;
      const t2 = this.state.ticks[2].digit;
      const t3 = this.state.ticks[3].digit;
      const t4 = this.state.ticks[4].digit;

      if (t0 === t1 && t1 === t2 && t3 === t4 && t0 !== t3) {
        xxyyyTrigger = true;
        xxyyyBarrier = t0; // Y is the barrier
      }
      if (t0 === t1 && t2 === t3 && t3 === t4 && t0 !== t2) {
        xxxyyTrigger = true;
        xxxyyBarrier = t0; // Y is the barrier
      }
    }

    if (this.state.running && !this.state.pendingTrade && this.cooldown === 0) {
      const availableModes = this.cfg.triggerMode === "th_dpst" ? this.state.remainingCycle : [this.cfg.triggerMode];

      let triggeredMode: Exclude<TriggerMode, "th_dpst"> | null = null;
      let barrier: number | null = null;

      for (const m of availableModes) {
        if (m === "xxyyy" && xxyyyTrigger && xxyyyBarrier !== null) {
          triggeredMode = m;
          barrier = xxyyyBarrier;
          break;
        }
        if (m === "xxxyy" && xxxyyTrigger && xxxyyBarrier !== null) {
          triggeredMode = m;
          barrier = xxxyyBarrier;
          break;
        }
        if (m === "any" && streak >= this.cfg.anyRepetitions) {
          triggeredMode = m;
          barrier = digit;
          break;
        }
        if (m === "odd" && digit % 2 !== 0 && streak >= this.cfg.oddRepetitions) {
          triggeredMode = m;
          barrier = digit;
          break;
        }
        if (m === "even" && digit % 2 === 0 && streak >= this.cfg.evenRepetitions) {
          triggeredMode = m;
          barrier = digit;
          break;
        }
        if (m === "specific" && digit === this.cfg.targetDigit && streak >= this.cfg.repetitionCount) {
          triggeredMode = m;
          barrier = this.cfg.targetDigit;
          break;
        }
      }

      if (triggeredMode !== null && barrier !== null) {
        this.placeTrade(barrier, triggeredMode);
      }
    }
  }


  private async placeTrade(barrierDigit: number, mode: Exclude<TriggerMode, "th_dpst">) {
    if (this.cfg.triggerMode === "th_dpst") {
      let nextCycle = this.state.remainingCycle.filter(m => m !== mode);
      if (nextCycle.length === 0) {
        nextCycle = this.shuffleArray(TH_DPST_CYCLE);
      }
      this.patch({ pendingTrade: true, streak: 0, streakDigit: null, remainingCycle: nextCycle });
    } else {
      this.patch({ pendingTrade: true, streak: 0, streakDigit: null });
    }
    this.streakDigit = null;
    this.cooldown = 2;

    try {
      const proposal = await this.send({
        proposal: 1,
        amount: this.cfg.stake,
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: this.state.currency || "USD",
        duration: 1,
        duration_unit: "t",
        underlying_symbol: SYMBOL,
        barrier: String(barrierDigit),
      });
      if (proposal.error) throw new Error(proposal.error.message);

      const buy = await this.send({ buy: proposal.proposal.id, price: this.cfg.stake });
      if (buy.error) throw new Error(buy.error.message);

      const contractId = buy.buy.contract_id;
      const trade: Trade = {
        id: String(contractId),
        time: Date.now(),
        digit: barrierDigit,
        buyPrice: asFiniteNumber(buy.buy.buy_price, this.cfg.stake),
        status: "open",
        mode,
      };
      this.patch({ trades: [trade, ...this.state.trades].slice(0, 100) });

      this.send({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1,
      }).catch(() => {});

      this.watchContract(String(contractId));
    } catch (e: any) {
      this.patch({ error: e?.message || "Trade failed", pendingTrade: false });
    }
  }

  private watchContract(contractId: string) {
    if (this.watchedContracts.has(contractId)) return;
    this.watchedContracts.add(contractId);
    const startedAt = Date.now();
    const MAX_WAIT = 60_000;
    const POLL_MS = 1500;

    const poll = async () => {
      const t = this.state.trades.find((x) => x.id === contractId);
      if (!t || t.status !== "open") {
        this.watchedContracts.delete(contractId);
        return;
      }
      if (Date.now() - startedAt > MAX_WAIT) {
        this.watchedContracts.delete(contractId);
        if (this.state.pendingTrade) {
          this.patch({
            pendingTrade: false,
            error: "Contract settlement timeout — released lock",
          });
        }
        return;
      }
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const res = await this.send({
            proposal_open_contract: 1,
            contract_id: Number(contractId),
          });
          if (res?.proposal_open_contract) {
            this.handleContractUpdate(res.proposal_open_contract);
          }
        }
      } catch {
        /* retry */
      }
      const after = this.state.trades.find((x) => x.id === contractId);
      if (after && after.status === "open") {
        window.setTimeout(poll, POLL_MS);
      } else {
        this.watchedContracts.delete(contractId);
      }
    };

    window.setTimeout(poll, POLL_MS);
  }

  private handleContractUpdate(c: any) {
    const settled =
      c.is_sold || c.is_expired || c.status === "won" || c.status === "lost";
    if (!settled) return;

    const contractId = String(c.contract_id);
    const existing = this.state.trades.find((t) => t.id === contractId);
    if (
      !existing ||
      existing.status !== "open" ||
      this.settledContracts.has(contractId)
    ) {
      this.watchedContracts.delete(contractId);
      if (existing?.status === "open") this.patch({ pendingTrade: false });
      return;
    }

    this.settledContracts.add(contractId);
    this.watchedContracts.delete(contractId);
    const profit = asFiniteNumber(
      c.profit ?? asFiniteNumber(c.sell_price) - asFiniteNumber(c.buy_price),
    );
    const status: Trade["status"] = profit >= 0 ? "won" : "lost";
    const trades = this.state.trades.map((t) =>
      t.id === contractId
        ? { ...t, status, profit, payout: asFiniteNumber(c.payout) }
        : t,
    );
    const pnl = this.state.pnl + profit;
    const wins = this.state.wins + (status === "won" ? 1 : 0);
    const losses = this.state.losses + (status === "lost" ? 1 : 0);
    const totalTrades = this.state.totalTrades + 1;

    this.patch({ trades, pnl, wins, losses, totalTrades, pendingTrade: false });

    const settledTrade = trades.find((t) => t.id === contractId)!;
    this.fire({ type: "trade_settled", trade: settledTrade, pnl });

    if (pnl <= -Math.abs(this.cfg.stopLoss)) {
      this.stop("stop_loss");
      this.patch({ error: `Stop Loss hit (${pnl.toFixed(2)})` });
      this.fire({ type: "stop_loss", pnl });
    } else if (pnl >= Math.abs(this.cfg.takeProfit)) {
      this.stop("take_profit");
      this.patch({ error: `Take Profit reached (${pnl.toFixed(2)})` });
      this.fire({ type: "take_profit", pnl });
    }
  }

  start() {
    const wasRunning = this.state.running;
    this.intentionalDisconnect = false;
    this.patch({ running: true, error: null });
    if (!this.state.connected) this.connect();
    if (!wasRunning) this.fire({ type: "bot_started" });
  }

  stop(reason: "manual" | "stop_loss" | "take_profit" = "manual") {
    const wasRunning = this.state.running;
    this.patch({ running: false });
    if (wasRunning) this.fire({ type: "bot_stopped", reason });
  }

  resetSession() {
    this.watchedContracts.clear();
    this.settledContracts.clear();
    this.patch({
      pnl: 0,
      wins: 0,
      losses: 0,
      totalTrades: 0,
      trades: [],
      streak: 0,
      streakDigit: null,
      error: null,
      remainingCycle: this.cfg.triggerMode === "th_dpst" ? this.shuffleArray(TH_DPST_CYCLE) : [...TH_DPST_CYCLE],
    });
  }

  disconnect() {
    this.wasAuthorized = false; // suppress auto-reconnect
    this.intentionalDisconnect = true;
    this.reconnectAttempts = 0;
    this.stop();
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.patch({
      connected: false,
      authorized: false,
      balance: null,
      lastDigit: null,
      lastPrice: null,
      streak: 0,
      streakDigit: null,
      ticks: [],
    });
  }
}
