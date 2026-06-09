// Client-side helpers for Deriv OAuth (PKCE).
// The client_id is a public identifier per the OAuth spec; it appears in the
// authorization URL anyway, so there's no value in hiding it server-side for
// a static SPA deployment.

const DERIV_CLIENT_ID = "33vntL6DjBvmbEkm9DseX";

export async function exchangeDerivCode(args: {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: DERIV_CLIENT_ID,
    code: args.code,
    code_verifier: args.code_verifier,
    redirect_uri: args.redirect_uri,
  });

  const res = await fetch("https://auth.deriv.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Deriv token exchange failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

export async function buildDerivAuthUrl(args: {
  redirect_uri: string;
  state: string;
  code_challenge: string;
}): Promise<{ url: string }> {
  const url = new URL("https://auth.deriv.com/oauth2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", DERIV_CLIENT_ID);
  url.searchParams.set("redirect_uri", args.redirect_uri);
  url.searchParams.set("scope", "trade");
  url.searchParams.set("state", args.state);
  url.searchParams.set("code_challenge", args.code_challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString() };
}
