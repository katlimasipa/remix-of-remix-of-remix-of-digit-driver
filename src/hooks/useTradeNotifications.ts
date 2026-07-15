import { useCallback, useEffect, useRef, useState } from "react";
import type { BotEvent, BotState } from "@/lib/derivBot";
import type { DerivAccount } from "@deriv/core";
import { notificationsSupported, pushRequiresInstall } from "@/lib/pwa";
import {
  ensurePushSubscription,
  getNotificationOwnerKey,
  sendPushToDevices,
  showLocalNotification,
} from "@/lib/pushClient";

type NotifyPayload = {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
};

export function useTradeNotifications(
  accounts: DerivAccount[],
  state: BotState | null,
) {
  const ownerKey = getNotificationOwnerKey(accounts.map((a) => a.account_id));
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "denied",
  );
  const supported = notificationsSupported();
  const seenTradesRef = useRef<Set<string>>(new Set());
  const lastRiskErrRef = useRef<string | null>(null);

  const notifyAllDevices = useCallback(
    async (payload: NotifyPayload) => {
      // Local notification only fires on this device if permission is granted.
      if (permission === "granted") void showLocalNotification(payload);
      // Remote push always fires — so laptop-run trades still reach the phone
      // even when this device hasn't granted browser permission.
      if (!ownerKey) return;
      try {
        await sendPushToDevices(ownerKey, payload);
      } catch (e) {
        console.warn("Push send failed", e);
      }
    },
    [ownerKey, permission],
  );

  const enable = useCallback(async () => {
    if (!supported) return false;
    if (pushRequiresInstall()) {
      window.alert(
        "On iPhone/iPad, install SmrtTrdr to your Home Screen first, then enable notifications from the installed app.",
      );
      return false;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted" || !ownerKey) return perm === "granted";
    try {
      await ensurePushSubscription(ownerKey);
      await notifyAllDevices({
        title: "Notifications enabled",
        body: "You'll get trade alerts on every signed-in device.",
        tag: "enabled",
      });
    } catch (e) {
      console.warn("Push subscription failed", e);
      await showLocalNotification({
        title: "Notifications enabled on this device",
        body: "Cross-device sync will work once push storage is configured.",
        tag: "enabled-local",
      });
    }
    return true;
  }, [supported, ownerKey, notifyAllDevices]);

  // Re-register this device when permission is already granted (new browser / after update).
  useEffect(() => {
    if (permission !== "granted" || !ownerKey) return;
    void ensurePushSubscription(ownerKey).catch(() => {});
  }, [permission, ownerKey]);

  // Seed seen trades on mount so we don't notify for history.
  useEffect(() => {
    if (!state?.trades) return;
    for (const t of state.trades) {
      if (t.status !== "open") seenTradesRef.current.add(t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trade won/lost alerts.
  useEffect(() => {
    if (!state?.trades) return;
    for (const t of state.trades) {
      if (t.status === "open") continue;
      if (seenTradesRef.current.has(t.id)) continue;
      seenTradesRef.current.add(t.id);
      const won = t.status === "won";
      const profit = typeof t.profit === "number" ? t.profit : 0;
      void notifyAllDevices({
        title: won ? "Trade won" : "Trade lost",
        body: `${won ? "+" : ""}${profit.toFixed(2)} ${state.currency} · Digit ${t.digit} · Session P/L ${state.pnl >= 0 ? "+" : ""}${state.pnl.toFixed(2)}`,
        tag: `trade-${t.id}`,
        vibrate: won ? [80, 40, 80] : [200],
      });
    }
  }, [state?.trades, state?.currency, state?.pnl, permission, notifyAllDevices]);

  // Stop loss / take profit alerts.
  useEffect(() => {
    const err = state?.error ?? null;
    if (!err || err === lastRiskErrRef.current) return;
    const isSL = err.startsWith("Stop Loss hit");
    const isTP = err.startsWith("Take Profit reached");
    if (!isSL && !isTP) return;
    lastRiskErrRef.current = err;
    void notifyAllDevices({
      title: isTP ? "Take Profit reached" : "Stop Loss hit",
      body: `${err} · Session ended · ${state?.wins ?? 0}W / ${state?.losses ?? 0}L`,
      tag: `risk-${Date.now()}`,
      requireInteraction: true,
      vibrate: isTP ? [80, 40, 80, 40, 200] : [300, 100, 300],
    });
  }, [state?.error, state?.wins, state?.losses, permission, notifyAllDevices]);

  const notifyBotEvent = useCallback(
    (event: BotEvent) => {
      
      if (event.type === "bot_started") {
        void notifyAllDevices({
          title: "Bot started",
          body: "SmrtTrdr is now running and will trade automatically.",
          tag: `bot-started-${Date.now()}`,
          vibrate: [60, 30, 60],
        });
      } else if (event.type === "bot_stopped") {
        const reasonLabel =
          event.reason === "stop_loss"
            ? "Stop Loss hit"
            : event.reason === "take_profit"
              ? "Take Profit reached"
              : "Stopped manually";
        void notifyAllDevices({
          title: "Bot stopped",
          body: `${reasonLabel}. The bot is no longer trading.`,
          tag: `bot-stopped-${Date.now()}`,
          requireInteraction: event.reason !== "manual",
          vibrate: [200, 80, 200],
        });
      }
    },
    [permission, notifyAllDevices],
  );

  return {
    supported,
    permission,
    enable,
    enabled: permission === "granted",
    denied: permission === "denied",
    requiresInstall: pushRequiresInstall(),
    notifyBotEvent,
  };
}
