// Deriv "classic" OAuth flow.
// Redirect to https://oauth.deriv.com/oauth2/authorize?app_id=<APP_ID>
// Deriv redirects back to the URL registered with your app, appending
// ?acct1=...&token1=...&cur1=... (one set per account on the user's profile).
// The token1 value is a regular Deriv API token that works with the
// legacy WebSocket `authorize` call — no PKCE / token exchange required.

export const DERIV_APP_ID = "33xUxNUY0Lcxf2cTguGuL";
const AUTH_ENDPOINT = "https://oauth.deriv.com/oauth2/authorize";

export function buildDerivAuthUrl(): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("app_id", DERIV_APP_ID);
  return url.toString();
}
