import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DERIV_CLIENT_ID =
  process.env.DERIV_CLIENT_ID ?? "33vntL6DjBvmbEkm9DseX";

const ExchangeSchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(20),
  redirect_uri: z.string().url(),
});

export const exchangeDerivCode = createServerFn({ method: "POST" })
  .inputValidator((data) => ExchangeSchema.parse(data))
  .handler(async ({ data }) => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: DERIV_CLIENT_ID,
      code: data.code,
      code_verifier: data.code_verifier,
      redirect_uri: data.redirect_uri,
    });

    const res = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Deriv token exchange failed (${res.status}): ${text}`);
    }

    const json = JSON.parse(text) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    return {
      access_token: json.access_token,
      expires_in: json.expires_in,
      token_type: json.token_type,
    };
  });

// Build the Deriv authorization URL on the server so client_id never appears
// in the client bundle. Returns the full URL the browser should navigate to.
const AuthUrlSchema = z.object({
  redirect_uri: z.string().url(),
  state: z.string().min(8),
  code_challenge: z.string().min(20),
});

export const buildDerivAuthUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => AuthUrlSchema.parse(d))
  .handler(async ({ data }) => {
    const url = new URL("https://auth.deriv.com/oauth2/auth");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", DERIV_CLIENT_ID);
    url.searchParams.set("redirect_uri", data.redirect_uri);
    url.searchParams.set("scope", "trade");
    url.searchParams.set("state", data.state);
    url.searchParams.set("code_challenge", data.code_challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { url: url.toString() };
  });
