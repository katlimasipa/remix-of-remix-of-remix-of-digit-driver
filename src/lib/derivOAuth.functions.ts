// Client-side helpers for Deriv OAuth.
// Deriv's classic OAuth flow doesn't require PKCE or a token exchange — the
// authorize endpoint redirects back to your registered redirect_uri with
// ?acct1=...&token1=...&cur1=... query params containing the tokens directly.

const DERIV_APP_ID = "33vntL6DjBvmbEkm9DseX";

export function buildDerivAuthUrl(args: { redirect_uri: string }): string {
  const url = new URL("https://oauth.deriv.com/oauth2/authorize");
  url.searchParams.set("app_id", DERIV_APP_ID);
  url.searchParams.set("l", "EN");
  url.searchParams.set("brand", "deriv");
  url.searchParams.set("redirect_uri", args.redirect_uri);
  return url.toString();
}

// Kept as a no-op stub so existing imports don't break. The classic OAuth
// flow returns tokens directly via query params, so no code exchange runs.
export async function exchangeDerivCode(_args: {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  throw new Error("PKCE token exchange is not used in classic Deriv OAuth flow.");
}
