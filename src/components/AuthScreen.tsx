import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Footer } from "./Footer";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (error) setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-md bg-primary/15">
              <div className="h-3 w-3 rounded-sm bg-primary" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">ThDpstSmrtTrdr</h1>
            <p className="mt-1 text-xs text-muted-foreground">Sign in to access your trading bot</p>
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-6 shadow-2xl shadow-black/30">
            <div className="mb-5 flex gap-1 rounded-md bg-surface-2 p-1 text-xs">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded px-3 py-2 font-medium transition-all ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm font-mono outline-none transition-colors focus:border-ring"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm font-mono outline-none transition-colors focus:border-ring"
                  placeholder="••••••••"
                />
              </label>

              {err && (
                <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {busy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Your Deriv API token is stored securely on your account.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
