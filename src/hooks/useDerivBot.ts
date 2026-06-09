import { useEffect, useRef, useState } from "react";
import { DerivBot, type BotConfig, type BotState } from "@/lib/derivBot";

const DEFAULT_CFG: BotConfig = {
  token: "",
  accessToken: "",
  symbol: "1HZ100V",
  stake: 1,
  triggerMode: "specific",
  targetDigit: 5,
  repetitionCount: 3,
  stopLoss: 10,
  takeProfit: 10,
  accountType: "demo",
};

export function useDerivBot() {
  const botRef = useRef<DerivBot | null>(null);
  const [state, setState] = useState<BotState | null>(null);
  const [cfg, setCfg] = useState<BotConfig>(DEFAULT_CFG);

  useEffect(() => {
    const bot = new DerivBot(cfg);
    botRef.current = bot;
    const unsub = bot.subscribe(setState);
    return () => {
      unsub();
      bot.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    botRef.current?.updateConfig(cfg);
  }, [cfg]);

  return {
    state,
    cfg,
    setCfg,
    connect: () => botRef.current?.connect(),
    start: () => botRef.current?.start(),
    stop: () => botRef.current?.stop(),
    reset: () => botRef.current?.resetSession(),
    disconnect: () => botRef.current?.disconnect(),
  };
}
