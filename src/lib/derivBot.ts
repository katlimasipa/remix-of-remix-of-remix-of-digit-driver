// Browser-side Deriv WebSocket bot — Digits Differ on Volatility 100 (1HZ100V).
// Uses Deriv's new API (api.derivws.com/trading/v1/options/...) with OAuth 2.0:
//   1. List trading accounts via REST (server function — keeps client_id off the client)
//   2. Request a one-time WS URL for the chosen account (server function)
//   3. Open the OTP-authenticated WebSocket — no `authorize` handshake needed
//
// Falls back to the legacy /websockets/v3 endpoint + `authorize` flow when the
// user supplies a manual API token (no OAuth session yet).

import {
  listDerivAccounts,
  getDerivOtp,
  createDerivAccount,
} from "./derivApi.functions";

export type TriggerMode = "specific" | "any" | "xxyyy" | "xxxyy" | "odd" | "even";

export type BotConfig = {
  /** Manual API token (legacy flow). Empty when OAuth is in use. */
  token: string;
  /** OAuth 2.0 access token (new flow). Empty when manual token is in use. */
  accessToken: string;
  symbol: string; // e.g. 1HZ100V (new) or R_100 (legacy)
  stake: number;
  triggerMode: TriggerMode;
  targetDigit: number;
  repetitionCount: number;
  stopLoss: number;
  takeProfit: number;
  accountType: "demo" | "real";
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

// New-API symbol name for Volatility 100 Index (1-second ticks).
const SYMBOL_NEW = "1HZ100V";
// Legacy-API symbol for the manual-token fallback.
const SYMBOL_LEGACY = "R_100";
const LEGACY_APP_ID = "1089";

export class DerivBot {
  private ws: WebSocket | null = null;
  private cfg: BotConfig;
  private listeners: Set<Listener> = new Set();
  private mode: "oauth" | "legacy" = "legacy";
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

  async connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    )
      return;

    this.patch({ error: null });

    const manualTok = (this.cfg.token ?? "").trim();
    // Deriv's new Personal Access Tokens start with `pat_` and only work on the
    // new API (api.derivws.com/trading/v1/options) — route them through OAuth.
    const manualIsPat = manualTok.toLowerCase().startsWith("pat_");

    // Prefer OAuth (new API) when an access_token or pat_ token is present.
    if (this.cfg.accessToken && this.cfg.accessToken.length > 10) {
      this.mode = "oauth";
      await this.connectOAuth();
    } else if (manualIsPat) {
      this.mode = "oauth";
      // Reuse the OAuth path with the pat_ token as the bearer.
      this.cfg = { ...this.cfg, accessToken: manualTok };
      await this.connectOAuth();
    } else if (manualTok.length > 0) {
      this.mode = "legacy";
      this.connectLegacy();
    } else {
      this.patch({ error: "No Deriv credentials — sign in or paste an API token" });
    }
  }

  private async connectOAuth() {
    try {
      const accounts = await listDerivAccounts({ access_token: this.cfg.accessToken });

      let account = accounts.find((a) => a.account_type === this.cfg.accountType);
      if (!account) {
        account = await createDerivAccount({
          access_token: this.cfg.accessToken,
          account_type: this.cfg.accountType,
        });
      }
      if (!account) {
        this.patch({ error: `No ${this.cfg.accountType} account available on Deriv` });
        return;
      }

      this.patch({
        balance: account.balance,
        currency: account.currency || "USD",
      });

      const { url } = await getDerivOtp({
        access_token: this.cfg.accessToken,
        account_id: account.account_id,
      });

      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        // OTP-authenticated — no `authorize` needed.
        this.patch({ connected: true, authorized: true, error: null });
        this.send({ balance: 1, subscribe: 1 }).catch(() => {});
        this.send({ ticks: SYMBOL_NEW, subscribe: 1 }).catch(() => {});
      };
      ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
      ws.onclose = () => {
        this.patch({ connected: false, authorized: false });
        if (this.state.running) this.scheduleReconnect();
      };
      ws.onerror = () => this.patch({ error: "WebSocket error" });
    } catch (e: any) {
      this.patch({ error: e?.message || "Failed to connect via OAuth" });
    }
  }

  private connectLegacy() {
    const ws = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${LEGACY_APP_ID}`,
    );
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
    ws.onerror = () => this.patch({ error: "WebSocket error" });
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
      // Only the legacy flow sees this — OAuth WS opens already authorized.
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
      this.send({ balance: 1, subscribe: 1 }).catch(() => {});
      this.send({ ticks: SYMBOL_LEGACY, subscribe: 1 }).catch(() => {});
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
    const s = price.toFixed(2);
    return parseInt(s[s.length - 1], 10);
  }

  private streakDigit: number | null = null;

  private handleTick(price: number) {
    const digit = this.lastDigitOf(price);
    const tick = { price, digit, time: Date.now() };
    const ticks = [tick, ...this.state.ticks].slice(0, 60);

    let streak = this.state.streak;
    let xxyyyTrigger = false;
    let xxyyyBarrier: number | null = null;
    let xxxyyTrigger = false;
    let xxxyyBarrier: number | null = null;

    if (this.cfg.triggerMode === "any") {
      if (this.streakDigit === digit) streak += 1;
      else {
        this.streakDigit = digit;
        streak = 1;
      }
    } else if (this.cfg.triggerMode === "odd" || this.cfg.triggerMode === "even") {
      const wantOdd = this.cfg.triggerMode === "odd";
      const matchesParity = wantOdd ? digit % 2 === 1 : digit % 2 === 0;
      if (!matchesParity) {
        this.streakDigit = null;
        streak = 0;
      } else if (this.streakDigit === digit) {
        streak += 1;
      } else {
        this.streakDigit = digit;
        streak = 1;
      }
    } else if (this.cfg.triggerMode === "xxyyy") {
      // Detect pattern X X Y Y Y (oldest -> newest). ticks[0] is newest.
      if (ticks.length >= 5) {
        const d0 = ticks[0].digit;
        const d1 = ticks[1].digit;
        const d2 = ticks[2].digit;
        const d3 = ticks[3].digit;
        const d4 = ticks[4].digit;
        if (d0 === d1 && d1 === d2 && d3 === d4 && d0 !== d3) {
          xxyyyTrigger = true;
          xxyyyBarrier = d0;
          streak = 5;
        } else {
          streak = 0;
        }
      } else {
        streak = 0;
      }
      this.streakDigit = null;
    } else if (this.cfg.triggerMode === "xxxyy") {
      // Detect pattern X X X Y Y (oldest -> newest). ticks[0] is newest.
      if (ticks.length >= 5) {
        const d0 = ticks[0].digit;
        const d1 = ticks[1].digit;
        const d2 = ticks[2].digit;
        const d3 = ticks[3].digit;
        const d4 = ticks[4].digit;
        if (d0 === d1 && d2 === d3 && d3 === d4 && d0 !== d2) {
          xxxyyTrigger = true;
          xxxyyBarrier = d0;
          streak = 5;
        } else {
          streak = 0;
        }
      } else {
        streak = 0;
      }
      this.streakDigit = null;
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
      this.cooldown === 0
    ) {
      if (this.cfg.triggerMode === "xxyyy") {
        if (xxyyyTrigger && xxyyyBarrier !== null) {
          this.placeTrade(xxyyyBarrier);
        }
      } else if (this.cfg.triggerMode === "xxxyy") {
        if (xxxyyTrigger && xxxyyBarrier !== null) {
          this.placeTrade(xxxyyBarrier);
        }
      } else if (streak >= this.cfg.repetitionCount) {
        this.placeTrade(digit);
      }
    }
  }

  private async placeTrade(triggerDigit: number) {
    const barrierDigit =
      this.cfg.triggerMode === "specific" ? this.cfg.targetDigit : triggerDigit;
    this.patch({ pendingTrade: true, streak: 0 });
    this.streakDigit = null;
    this.cooldown = 2;

    const symbol = this.mode === "oauth" ? SYMBOL_NEW : SYMBOL_LEGACY;
    // New API uses `underlying_symbol`; legacy uses `symbol`.
    const symbolField =
      this.mode === "oauth"
        ? { underlying_symbol: symbol }
        : { symbol };

    try {
      const proposal = await this.send({
        proposal: 1,
        amount: this.cfg.stake,
        basis: "stake",
        contract_type: "DIGITDIFF",
        currency: this.state.currency || "USD",
        duration: 1,
        duration_unit: "t",
        ...symbolField,
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

  private watchedContracts = new Set<string>();
  private settledContracts = new Set<string>();

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
    if (!c.is_sold) return;
    const contractId = String(c.contract_id);
    const existingTrade = this.state.trades.find((t) => t.id === contractId);

    if (
      !existingTrade ||
      existingTrade.status !== "open" ||
      this.settledContracts.has(contractId)
    ) {
      this.watchedContracts.delete(contractId);
      if (existingTrade?.status === "open") this.patch({ pendingTrade: false });
      return;
    }

    this.settledContracts.add(contractId);
    this.watchedContracts.delete(contractId);
    const profit = Number(c.profit);
    const status: Trade["status"] = profit >= 0 ? "won" : "lost";
    const trades = this.state.trades.map((t) =>
      t.id === contractId ? { ...t, status, profit, payout: c.payout } : t,
    );
    const pnl = this.state.pnl + profit;
    const wins = this.state.wins + (status === "won" ? 1 : 0);
    const losses = this.state.losses + (status === "lost" ? 1 : 0);
    const totalTrades = this.state.totalTrades + 1;

    this.patch({ trades, pnl, wins, losses, totalTrades, pendingTrade: false });

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
    this.watchedContracts.clear();
    this.settledContracts.clear();
    this.patch({
      pnl: 0,
      wins: 0,
      losses: 0,
      totalTrades: 0,
      trades: [],
      streak: 0,
      error: null,
    });
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
