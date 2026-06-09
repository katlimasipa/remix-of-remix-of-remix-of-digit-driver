// Client-side helpers for Deriv OAuth 2.0 (PKCE flow).
// The credential below is a Deriv OAuth 2.0 client_id (public — safe to ship
// in the client per the OAuth 2.0 spec for public clients using PKCE).
const DERIV_CLIENT_ID = "33vntL6DjBvmbEkm9DseX";
const AUTH_ENDPOINT = "https://oauth.deriv.com/oauth2/authorize";
const TOKEN_ENDPOINT = "https://oauth.deriv.com/oauth2/token";
const SCOPE = "read trade trading_information payments admin";

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function generatePkce(): Promise<{
  verifier: string;
  challenge: string;
  state: string;
}> {
  const verifierBytes = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64UrlEncode(new Uint8Array(digest));
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = base64UrlEncode(stateBytes);
  return { verifier, challenge, state };
}

export function buildDerivAuthUrl(args: {
  redirect_uri: string;
  code_challenge: string;
  state: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", DERIV_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", args.redirect_uri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", args.state);
  url.searchParams.set("code_challenge", args.code_challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeDerivCode(args: {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirect_uri,
    client_id: DERIV_CLIENT_ID,
    code_verifier: args.code_verifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Deriv token exchange failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}
