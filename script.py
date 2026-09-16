import sys

# 1. Update derivBot.ts
with open("src/lib/derivBot.ts", "r", encoding="utf-8") as f:
    bot = f.read()

bot = bot.replace("""this.patch({ connected: true });
      this.send({ authorize: token });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));""", """this.patch({ connected: true });
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
    };""")

bot = bot.replace("""if (msg.error) {
        this.patch({ error: msg.error.message, authorized: false });
        return;
      }""", """if (msg.error) {
        console.error("[DerivBot] Authorization failed:", msg.error.code, msg.error.message);
        this.patch({ error: "Auth failed: " + msg.error.message + " (code: " + msg.error.code + ")", authorized: false });
        return;
      }""")

with open("src/lib/derivBot.ts", "w", encoding="utf-8") as f:
    f.write(bot)

# 2. Update index.tsx
with open("src/routes/index.tsx", "r", encoding="utf-8") as f:
    idx = f.read()

idx = idx.replace("""autoConnectedRef.current = true;
      // Auto-provision before connecting
      createDerivAccount({ access_token: token, account_type: accountType }).then(() => {
        setTimeout(() => connect(), 0);
      }).catch(err => {
        console.error("Auto-provision error:", err);
        setTokenLoadError("API Provisioning Failed: " + err.message);
        setTimeout(() => connect(), 0);
      });
      setTimeout(() => connect(), 0);""", """autoConnectedRef.current = true;
      setTimeout(() => connect(), 0);""")

idx = idx.replace("""setSavingToken(true);
      try {
        if (token.trim()) {
          await createDerivAccount({ access_token: token.trim(), account_type: accountType });
        }
      } catch (err) {
        console.warn("Failed to provision account via API:", err);
      }
      const { error } = await supabase.from("profiles").upsert({""", """setSavingToken(true);
      const { error } = await supabase.from("profiles").upsert({""")

with open("src/routes/index.tsx", "w", encoding="utf-8") as f:
    f.write(idx)

print("Replacements done.")