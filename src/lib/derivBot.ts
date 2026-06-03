// Browser-side Deriv WebSocket bot — Digits Differ on Volatility 100
// Token lives only in this module's instance memory + sessionStorage; never sent to our server.

export type TriggerMode = "specific" | "any";

export type BotConfig = {
  token: string;
  appId: string;
  symbol: string; // e.g. R_100
  stake: number;
  triggerMode: TriggerMode; // "specific" = only targetDigit, "any" = any digit that repeats
  targetDigit: number; // 0-9 (used when triggerMode === "specific")
  repetitionCount: number;
  stopLoss: number; // positive USD
  takeProfit: number; // positive USD
};

export type Trade = {
  id: string;
  time: number;
  digit: number;
  buyPrice: number;
  payout?: number;
  profit?: number;
  status: "open" | "won" | "lost";
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
  ticks: { price: number; digit: number; time: number }[];
  trades: Trade[];
  pnl: number;
  wins: number;
  losses: number;
  totalTrades: number;
  error: string | null;
  pendingTrade: boolean;
};

type Listener = (s: BotState) => void;

const SYMBOL = "R_100";

export class DerivBot {
  private ws: WebSocket | null = null;
  private cfg: BotConfig;
  private listeners: Set<Listener> = new Set();
  private state: BotState = {
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
  private reqId = 1;
  private pending = new Map<number, (msg: any) => void>();
  private reconnectTimer: number | null = null;
  private cooldown = 0;

  constructor(cfg: BotConfig) {
    this.cfg = cfg;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
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
    this.cfg = { ...this.cfg, ...p };
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    )
      return;
    this.patch({ error: null });
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.cfg.appId}`);
    this.ws = ws;
    ws.onopen = () => {
      this.patch({ connected: true });
      this.send({ authorize: this.cfg.token.trim() });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      this.patch({ connected: false, authorized: false });
      if (this.state.running) this.scheduleReconnect();
    };
    ws.onerror = () => {
      this.patch({ error: "WebSocket error" });
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private send(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WS not open"));
        return;
      }
      const req_id = this.reqId++;
      this.pending.set(req_id, resolve);
      this.ws.send(JSON.stringify({ ...payload, req_id }));
      // safety timeout
      setTimeout(() => {
        if (this.pending.has(req_id)) {
          this.pending.delete(req_id);
          reject(new Error("Request timeout"));
        }
      }, 15000);
    });
  }

  private onMessage(msg: any) {
    if (msg.req_id && this.pending.has(msg.req_id)) {
      const fn = this.pending.get(msg.req_id)!;
      this.pending.delete(msg.req_id);
      fn(msg);
    }

    if (msg.msg_type === "authorize") {
      if (msg.error) {
        this.patch({ error: msg.error.message, authorized: false });
        return;
      }
      this.patch({
        authorized: true,
        balance: msg.authorize.balance,
        currency: msg.authorize.currency,
        error: null,
      });
      // subscribe to balance + ticks
      this.send({ balance: 1, subscribe: 1 }).catch(() => {});
      this.send({ ticks: SYMBOL, subscribe: 1 }).catch(() => {});
    }

    if (msg.msg_type === "balance" && msg.balance) {
      this.patch({ balance: msg.balance.balance, currency: msg.balance.currency });
    }

    if (msg.msg_type === "tick" && msg.tick) {
      this.handleTick(msg.tick.quote);
    }

    if (msg.msg_type === "proposal_open_contract" && msg.proposal_open_contract) {
      this.handleContractUpdate(msg.proposal_open_contract);
    }

    if (msg.error && !msg.req_id) {
      this.patch({ error: msg.error.message });
    }
  }

  private lastDigitOf(price: number): number {
    // Deriv ticks come with variable decimals; use the string form for true last digit
    const s = price.toFixed(2);
    return parseInt(s[s.length - 1], 10);
  }

  private streakDigit: number | null = null;

  private handleTick(price: number) {
    const digit = this.lastDigitOf(price);
    const tick = { price, digit, time: Date.now() };
    const ticks = [tick, ...this.state.ticks].slice(0, 60);

    let streak = this.state.streak;
    if (this.cfg.triggerMode === "any") {
      // Streak = how many times the current digit has repeated in a row
      if (this.streakDigit === digit) streak += 1;
      else {
        this.streakDigit = digit;
        streak = 1;
      }
    } else {
      if (digit === this.cfg.targetDigit) streak += 1;
      else streak = 0;
      this.streakDigit = this.cfg.targetDigit;
    }

    this.patch({ lastDigit: digit, lastPrice: price, ticks, streak });

    if (this.cooldown > 0) this.cooldown -= 1;

    if (
      this.state.running &&
      !this.state.pendingTrade &&
      this.cooldown === 0 &&
      streak >= this.cfg.repetitionCount
    ) {
      this.placeTrade(digit);
    }
  }

  private async placeTrade(triggerDigit: number) {
    // In "any" mode, trade DIGITDIFF against the digit that just repeated.
    // In "specific" mode, always use the configured targetDigit.
    const barrierDigit =
      this.cfg.triggerMode === "any" ? triggerDigit : this.cfg.targetDigit;
    this.patch({ pendingTrade: true, streak: 0 });
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
        symbol: SYMBOL,
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
        buyPrice: buy.buy.buy_price,
        status: "open",
      };
      this.patch({ trades: [trade, ...this.state.trades].slice(0, 100) });

      // Subscribe to contract updates
      this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }).catch(
        () => {},
      );
    } catch (e: any) {
      this.patch({ error: e?.message || "Trade failed", pendingTrade: false });
    }
  }

  private handleContractUpdate(c: any) {
    if (!c.is_sold) return;
    const profit = Number(c.profit);
    const status: Trade["status"] = profit >= 0 ? "won" : "lost";
    const trades = this.state.trades.map((t) =>
      t.id === String(c.contract_id) ? { ...t, status, profit, payout: c.payout } : t,
    );
    const pnl = this.state.pnl + profit;
    const wins = this.state.wins + (status === "won" ? 1 : 0);
    const losses = this.state.losses + (status === "lost" ? 1 : 0);
    const totalTrades = this.state.totalTrades + 1;

    this.patch({ trades, pnl, wins, losses, totalTrades, pendingTrade: false });

    // Risk management
    if (pnl <= -Math.abs(this.cfg.stopLoss)) {
      this.stop();
      this.patch({ error: `Stop Loss hit (${pnl.toFixed(2)})` });
    } else if (pnl >= Math.abs(this.cfg.takeProfit)) {
      this.stop();
      this.patch({ error: `Take Profit reached (${pnl.toFixed(2)})` });
    }
  }

  start() {
    this.patch({ running: true, error: null });
    if (!this.state.connected) this.connect();
  }

  stop() {
    this.patch({ running: false });
  }

  resetSession() {
    this.patch({ pnl: 0, wins: 0, losses: 0, totalTrades: 0, trades: [], streak: 0, error: null });
  }

  disconnect() {
    this.stop();
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
      ticks: [],
    });
  }
}
