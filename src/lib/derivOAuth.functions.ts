import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ExchangeSchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(20),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
});

export const exchangeDerivCode = createServerFn({ method: "POST" })
  .inputValidator((data) => ExchangeSchema.parse(data))
  .handler(async ({ data }) => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: data.client_id,
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
