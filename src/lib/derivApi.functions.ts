// Client-side helpers for Deriv REST API.
import { DERIV_APP_ID } from "./derivOAuth.functions";
const REST_BASE = "https://api.derivws.com";

export type DerivAccount = {
  account_id: string;
  balance: number;
  currency: string;
  account_type: "demo" | "real";
};

function headers(token: string) {
  return {
    Authorization: `Bearer `,
    "Deriv-App-ID": DERIV_APP_ID,
  } as Record<string, string>;
}

export async function listDerivAccounts(args: {
  access_token: string;
}): Promise<DerivAccount[]> {
  const res = await fetch(`/trading/v1/options/accounts`, {
    headers: headers(args.access_token),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Deriv listAccounts failed (): `);
  const json = JSON.parse(text) as { data: DerivAccount[] };
  return json.data ?? [];
}

export async function getDerivOtp(args: {
  access_token: string;
  account_id: string;
}): Promise<{ url: string }> {
  const res = await fetch(
    `/trading/v1/options/accounts//otp`,
    { method: "POST", headers: headers(args.access_token) },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Deriv OTP request failed (): `);
  const json = JSON.parse(text) as { data: { url: string } };
  if (!json.data?.url) throw new Error("Deriv OTP response missing URL");
  return { url: json.data.url };
}

export async function createDerivAccount(args: {
  access_token: string;
  account_type: "demo" | "real";
}): Promise<DerivAccount> {
  const res = await fetch(`/trading/v1/options/accounts`, {
    method: "POST",
    headers: { ...headers(args.access_token), "Content-Type": "application/json" },
    body: JSON.stringify({
      currency: "USD",
      group: "row",
      account_type: args.account_type,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Deriv createAccount failed (): `);
  const json = JSON.parse(text) as { data: DerivAccount[] | DerivAccount };
  return Array.isArray(json.data) ? json.data[0] : json.data;
}