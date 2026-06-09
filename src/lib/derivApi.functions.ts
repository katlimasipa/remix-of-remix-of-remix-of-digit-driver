import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public client_id (Deriv's spec calls this a non-secret identifier),
// but we keep it server-side so it never appears in the client bundle
// or visible UI. Override via DERIV_CLIENT_ID env var if rotated.
const DERIV_CLIENT_ID =
  process.env.DERIV_CLIENT_ID ?? "33vntL6DjBvmbEkm9DseX";

const REST_BASE = "https://api.derivws.com";

const TokenSchema = z.object({ access_token: z.string().min(10) });

export type DerivAccount = {
  account_id: string;
  balance: number;
  currency: string;
  account_type: "demo" | "real";
};

export const listDerivAccounts = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data }): Promise<DerivAccount[]> => {
    const res = await fetch(`${REST_BASE}/trading/v1/options/accounts`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "Deriv-App-ID": DERIV_CLIENT_ID,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Deriv listAccounts failed (${res.status}): ${text}`);
    }
    const json = JSON.parse(text) as { data: DerivAccount[] };
    return json.data ?? [];
  });

const OtpSchema = z.object({
  access_token: z.string().min(10),
  account_id: z.string().min(3),
});

export const getDerivOtp = createServerFn({ method: "POST" })
  .inputValidator((d) => OtpSchema.parse(d))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const res = await fetch(
      `${REST_BASE}/trading/v1/options/accounts/${encodeURIComponent(data.account_id)}/otp`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          "Deriv-App-ID": DERIV_CLIENT_ID,
        },
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Deriv OTP request failed (${res.status}): ${text}`);
    }
    const json = JSON.parse(text) as { data: { url: string } };
    if (!json.data?.url) throw new Error("Deriv OTP response missing URL");
    return { url: json.data.url };
  });

// Also expose a helper that creates a demo account if the user has none
const CreateAccountSchema = z.object({
  access_token: z.string().min(10),
  account_type: z.enum(["demo", "real"]),
});

export const createDerivAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateAccountSchema.parse(d))
  .handler(async ({ data }): Promise<DerivAccount> => {
    const res = await fetch(`${REST_BASE}/trading/v1/options/accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "Deriv-App-ID": DERIV_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency: "USD",
        group: "row",
        account_type: data.account_type,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Deriv createAccount failed (${res.status}): ${text}`);
    }
    const json = JSON.parse(text) as { data: DerivAccount[] | DerivAccount };
    return Array.isArray(json.data) ? json.data[0] : json.data;
  });
