const fs = require('fs');

// 1. Update derivApi.functions.ts
let apiFuncs = fs.readFileSync('src/lib/derivApi.functions.ts', 'utf8');
apiFuncs = "import { DERIV_APP_ID } from './derivOAuth.functions';\n" + apiFuncs;
apiFuncs = apiFuncs.replace('"Deriv-App-ID": "1089"', '"Deriv-App-ID": DERIV_APP_ID');
fs.writeFileSync('src/lib/derivApi.functions.ts', apiFuncs, 'utf8');

// 2. Update index.tsx
let idx = fs.readFileSync('src/routes/index.tsx', 'utf8');
idx = idx.replace(
    '// REST API helpers are available if needed for OAuth flow',
    'import { createDerivAccount } from "@/lib/derivApi.functions";'
);
idx = idx.replace(
    'setSavingToken(true);\n      const { error } = await supabase.from("profiles").upsert({',
    'setSavingToken(true);\n      try {\n        if (token.trim()) {\n          await createDerivAccount({ access_token: token.trim(), account_type: accountType });\n        }\n      } catch (err) {\n        console.warn("Failed to provision account via API:", err);\n      }\n      const { error } = await supabase.from("profiles").upsert({'
);
fs.writeFileSync('src/routes/index.tsx', idx, 'utf8');

// 3. Update derivBot.ts
let bot = fs.readFileSync('src/lib/derivBot.ts', 'utf8');

bot = bot.replace(
    '// DERIV_APP_ID is for OAuth flow only\r\n// REST API helpers available for OAuth flow if needed',
    'import { listDerivAccounts, createDerivAccount, getDerivOtp } from "./derivApi.functions";'
);
bot = bot.replace(
    '// DERIV_APP_ID is for OAuth flow only\n// REST API helpers available for OAuth flow if needed',
    'import { listDerivAccounts, createDerivAccount, getDerivOtp } from "./derivApi.functions";'
);

const oldConnect1 = `  async connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    )
      return;

    this.patch({ error: null });

    const token = (this.cfg.token ?? "").trim();
    if (!token) {
      this.patch({ error: "Not signed in" });
      return;
    }`;

const oldConnect2 = `    // Use the standard v3 WebSocket (supports full schema including \`symbol\`)
    // and authorize with the PAT token via the \`authorize\` message.
    const ws = new WebSocket(
      \`wss://ws.derivws.com/websockets/v3?app_id=1089\`,
    );
    this.ws = ws;
    ws.onopen = () => {
      this.patch({ connected: true });
      console.log("[DerivBot] WS open, authorizing with token:", token.substring(0, 4) + "..." + token.substring(token.length - 4));
      console.log("[DerivBot] Token length:", token.length);
      this.send({ authorize: token });
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.msg_type === "authorize") {
        console.log("[DerivBot] Authorize response:", JSON.stringify(data).substring(0, 300));
      }
      this.onMessage(data);
    };
    ws.onclose = () => {
      this.patch({ connected: false, authorized: false });
      if (this.state.running) this.scheduleReconnect();
    };
    ws.onerror = () => this.patch({ error: "WebSocket error" });
  }`;

const newConnect2 = `    try {
      let accounts = await listDerivAccounts({ access_token: token });
      let account = accounts.find((a) => a.account_type === this.cfg.accountType);

      if (!account) {
        account = await createDerivAccount({
          access_token: token,
          account_type: this.cfg.accountType,
        });
      }

      const { url } = await getDerivOtp({
        access_token: token,
        account_id: account.account_id,
      });

      const ws = new WebSocket(url);
      this.ws = ws;
      
      ws.onopen = () => {
        this.patch({ 
          connected: true, 
          authorized: true, 
          balance: account.balance, 
          currency: account.currency 
        });
        this.send({ balance: 1, subscribe: 1 }).catch(() => {});
        this.send({ ticks: SYMBOL, subscribe: 1 }).catch(() => {});
      };
      
      ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
      
      ws.onclose = () => {
        this.patch({ connected: false, authorized: false });
        if (this.state.running) this.scheduleReconnect();
      };
      
      ws.onerror = () => this.patch({ error: "WebSocket error" });
      
    } catch (e) {
      this.patch({ error: e.message || "Failed to connect via PAT", connected: false });
    }
  }`;

bot = bot.replace(oldConnect2, newConnect2);

const oldProposalError = `if (msg.error) {
        console.error("[DerivBot] Authorization failed:", msg.error.code, msg.error.message);
        this.patch({ error: "Auth failed: " + msg.error.message + " (code: " + msg.error.code + ")", authorized: false });
        return;
      }`;
const newProposalError = `if (msg.error) {
        this.patch({ error: msg.error.message, authorized: false });
        return;
      }`;
bot = bot.replace(oldProposalError, newProposalError);

const oldSymbolField = `const symbolField = { symbol: SYMBOL };`;
const newSymbolField = `const symbolField = { underlying_symbol: SYMBOL };`;
bot = bot.replace(oldSymbolField, newSymbolField);

fs.writeFileSync('src/lib/derivBot.ts', bot, 'utf8');

console.log('done');
