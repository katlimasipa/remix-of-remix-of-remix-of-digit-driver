import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  VAPID_PUBLIC_KEY,
  sendPushToSubscriptions,
  type SubRow,
} from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(
  async () => ({ key: VAPID_PUBLIC_KEY }),
);

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  userAgent: z.string().max(500).optional(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => subscribeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: z.string().url().max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

const pushSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  tag: z.string().max(120).optional(),
  url: z.string().max(500).optional(),
  requireInteraction: z.boolean().optional(),
  vibrate: z.array(z.number().int().min(0).max(2000)).max(10).optional(),
});

export const sendPushToMyDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pushSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const subs = (rows ?? []) as SubRow[];
    if (subs.length === 0) return { sent: 0 };

    const { sent, gone } = await sendPushToSubscriptions(subs, data);
    if (gone.length) {
      await supabase.from("push_subscriptions").delete().in("id", gone);
    }
    return { sent };
  });
