// Server-only Web Push helpers. VAPID keys configured here.
// Public key is exposed to clients (safe). Private key never leaves the server.
import webpush from "web-push";

export const VAPID_PUBLIC_KEY =
  "BA5_emacth6TtdY5059cT8eBoGtVhUY1YiyA_3FsXq7F68TdJVfHcL-tJgE0S-LSHjEXNulDvgdsNwL50Zmk6aM";
const VAPID_PRIVATE_KEY = "oFiys_YUOuT_orQ3ZVDfEGRmCBrMBQocoNfk_7f2pFw";
const VAPID_SUBJECT = "mailto:notifications@smrttrdr.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
};

export type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToSubscriptions(
  subs: SubRow[],
  payload: PushPayload,
): Promise<{ sent: number; gone: string[] }> {
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 },
        );
        sent++;
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (status === 404 || status === 410) gone.push(sub.id);
        else console.error("web-push error", status, err);
      }
    }),
  );
  return { sent, gone };
}
