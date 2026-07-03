import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initiateLogin,
  initiateSignUp,
  handleOAuthCallback,
  refreshAccessToken,
  fetchAccounts,
  getWebSocketOTP,
  logout as coreLogout,
  getAuthInfo,
  getDerivAccounts,
  getActiveLoginId,
  setActiveLoginId,
  setAccountType,
  clearAllAuthData,
  parseReferralLink,
  getStoredAuthInfo,
} from '@deriv/core';
import type { AuthInfo, DerivAccount, AuthState, AuthConfig } from '@deriv/core';

function getAuthConfig(): AuthConfig {
  const config: AuthConfig = {
    clientId: import.meta.env.VITE_DERIV_APP_ID || '33CVw800TTYMR0RcYLNfx',
    redirectUri:
      import.meta.env.VITE_DERIV_REDIRECT_URI ||
      'https://thdpstdgtdffrs.vercel.app/',
  };

  const scopesEnv = import.meta.env.VITE_DERIV_OAUTH_SCOPES ?? '';
  if (scopesEnv) {
    config.scopes = scopesEnv.split(',').map((s: string) => s.trim()).join(' ');
  }

  const referralLink = import.meta.env.VITE_DERIV_REFERRAL_LINK ?? '';
  if (referralLink) {
    const referral = parseReferralLink(referralLink);
    if (referral) {
      config.affiliateToken      = referral.affiliateToken;
      config.affiliateTokenParam = referral.affiliateTokenParam;
      config.utmCampaign         = referral.utmCampaign;
      config.utmSource           = referral.utmSource;
      config.utmMedium           = referral.utmMedium;
    }
  }

  return config;
}

export interface UseAuthReturn {
  accessToken: string | null;
  getAuthInfo: any;
  authState: AuthState;
  accounts: DerivAccount[];
  activeAccount: DerivAccount | null;
  activeAccountId: string | null;
  wsUrl: string | undefined;
  login: () => Promise<void>;
  signUp: () => Promise<void>;
  logout: () => void;
  switchAccount: (accountId: string) => Promise<void>;
  refreshWebSocketUrl: () => Promise<string | undefined>;
  error: string | null;
}

async function getUsableAuthInfo(): Promise<AuthInfo | null> {
  const current = getAuthInfo();
  if (current) return current;

  const stored = getStoredAuthInfo();
  if (!stored?.refresh_token) return null;

  return refreshAccessToken(stored.refresh_token, getAuthConfig().clientId);
}

export function useDerivAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(() =>
    typeof window !== 'undefined' && getAuthInfo() ? 'authenticated' : 'unauthenticated'
  );
  const [accounts, setAccounts] = useState<DerivAccount[]>(() => {
    if (typeof window === 'undefined') return [];
    return getDerivAccounts() ?? [];
  });
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getActiveLoginId() ?? null;
  });
  const [wsUrl, setWsUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);
  const activeAccountIdRef = useRef<string | null>(activeAccountId);
  const tabHiddenAtRef = useRef<number | null>(null);

  const fetchOTPUrl = useCallback(async (accountId: string, authInfo: AuthInfo): Promise<string> => {
    return getWebSocketOTP(accountId, authInfo, getAuthConfig().clientId);
  }, []);

  const completeAuth = useCallback(async (authInfo: AuthInfo) => {
    const fetchedAccounts = await fetchAccounts(authInfo, getAuthConfig().clientId);
    setAccounts(fetchedAccounts);

    if (fetchedAccounts.length > 0) {
      const firstAccount = fetchedAccounts[0];
      setActiveAccountId(firstAccount.account_id);

      const otpUrl = await fetchOTPUrl(firstAccount.account_id, authInfo);
      setWsUrl(otpUrl);
    }

    setAuthState('authenticated');
  }, [fetchOTPUrl]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        setAuthState('authenticating');
        try {
          const authInfo = await handleOAuthCallback(window.location.href, getAuthConfig());
          // Remove ?code=... from URL to clean up
          window.history.replaceState({}, document.title, window.location.pathname);
          await completeAuth(authInfo);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Authentication failed');
          setAuthState('error');
          clearAllAuthData();
        }
        return;
      }

      const storedAuth = getStoredAuthInfo();
      if (storedAuth) {
        if (storedAuth.expires_at && Date.now() / 1000 > storedAuth.expires_at) {
          try {
            const refreshed = await refreshAccessToken(
              storedAuth.refresh_token,
              getAuthConfig().clientId
            );
            await completeAuth(refreshed);
          } catch {
            clearAllAuthData();
            setAuthState('unauthenticated');
          }
          return;
        }

        const storedAccounts = getDerivAccounts();
        if (storedAccounts && storedAccounts.length > 0) {
          setAccounts(storedAccounts);
          const loginId = getActiveLoginId() ?? storedAccounts[0].account_id;
          setActiveAccountId(loginId);

          try {
            const otpUrl = await fetchOTPUrl(loginId, storedAuth);
            setWsUrl(otpUrl);
            setAuthState('authenticated');
          } catch {
            clearAllAuthData();
            setAuthState('unauthenticated');
          }
        } else {
          try {
            await completeAuth(storedAuth);
          } catch {
            clearAllAuthData();
            setAuthState('unauthenticated');
          }
        }
      }
    };

    init();
  }, [completeAuth, fetchOTPUrl]);

  useEffect(() => {
    activeAccountIdRef.current = activeAccountId;
  }, [activeAccountId]);

  useEffect(() => {
    if (authState !== 'authenticated') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        tabHiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = tabHiddenAtRef.current;
      if (!hiddenAt || Date.now() - hiddenAt < 30_000) return;
      tabHiddenAtRef.current = null;

      const accountId = activeAccountIdRef.current;
      const authInfo = await getUsableAuthInfo();
      if (!authInfo || !accountId) return;

      try {
        const otpUrl = await fetchOTPUrl(accountId, authInfo);
        setWsUrl(otpUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection refresh failed');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authState, fetchOTPUrl]);

  const login = useCallback(async () => {
    await initiateLogin(getAuthConfig());
  }, []);

  const signUp = useCallback(async () => {
    await initiateSignUp(getAuthConfig());
  }, []);

  const logout = useCallback(() => {
    coreLogout();
    setAccounts([]);
    setActiveAccountId(null);
    setWsUrl(undefined);
    setAuthState('unauthenticated');
    setError(null);
  }, []);

  const switchAccount = useCallback(async (accountId: string) => {
    const authInfo = await getUsableAuthInfo();
    if (!authInfo) return;

    try {
      const account = accounts.find((a) => a.account_id === accountId);
      if (account) setAccountType(account.account_type);
      const otpUrl = await fetchOTPUrl(accountId, authInfo);
      setActiveLoginId(accountId);
      setActiveAccountId(accountId);
      setWsUrl(otpUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account switch failed');
    }
  }, [fetchOTPUrl, accounts]);

  const refreshWebSocketUrl = useCallback(async () => {
    const accountId = activeAccountIdRef.current;
    const authInfo = await getUsableAuthInfo();
    if (!authInfo || !accountId) return undefined;

    try {
      const otpUrl = await fetchOTPUrl(accountId, authInfo);
      setWsUrl(otpUrl);
      setAuthState('authenticated');
      setError(null);
      return otpUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection refresh failed');
      throw err;
    }
  }, [fetchOTPUrl]);

  const activeAccount = accounts.find((acc) => acc.account_id === activeAccountId) ?? accounts[0] ?? null;

  return {
    accessToken: getAuthInfo()?.access_token ?? null,
    getAuthInfo,
    authState,
    accounts,
    activeAccount,
    activeAccountId,
    wsUrl,
    login,
    signUp,
    logout,
    switchAccount,
    refreshWebSocketUrl,
    error,
  };
}

