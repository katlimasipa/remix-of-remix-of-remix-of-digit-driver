import { useState } from "react";

import { useAppAuth } from "@/hooks/useAppAuth";
import { Footer } from "./Footer";
import { PwaInstallBanner, PwaInstallButton } from "./PwaInstall";

export function AuthScreen({ login, signUp, authState, error }: { login: () => void, signUp: () => void, authState: string, error: string | null }) {
  const app = useAppAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") await app.signUp(email.trim(), password);
    else await app.signIn(email.trim(), password);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex justify-end px-4 pt-4">
        <PwaInstallButton />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-md bg-primary/15">
              <div className="h-3 w-3 rounded-sm bg-primary" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">ThDpstSmrtTrdr</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {app.user
                ? "Now connect your Deriv account to trade"
                : "Create a profile â€” it syncs alerts across your devices"}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-6 shadow-2xl shadow-black/30">
            {!app.user ? (
              <form onSubmit={submit} className="space-y-3">
                {app.error && (
                  <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
                    {app.error}
                  </div>
                )}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={app.busy}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {app.busy ? "Please wait..." : mode === "signup" ? "Create profile" : "Log in"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {mode === "signup"
                    ? "Already have a profile? Log in"
                    : "New here? Create a profile"}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                {error && (
                  <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
                    {error}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Signed in as <span className="text-foreground">{app.user.email}</span>
                </p>
                <button
                  type="button"
                  onClick={login}
                  disabled={authState === "authenticating"}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {authState === "authenticating" ? "Authenticating..." : "Log In with Deriv"}
                </button>

                <button
                  type="button"
                  onClick={signUp}
                  disabled={authState === "authenticating"}
                  className="w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent disabled:opacity-50"
                >
                  Create Deriv Account
                </button>
                <button
                  type="button"
                  onClick={() => void app.signOut()}
                  className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Sign out of profile
                </button>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Connect securely via Deriv OAuth.
          </p>
        </div>
      </main>
      <Footer />
      <PwaInstallBanner />
    </div>
  );
}


