import { useDerivAuth } from "@/hooks/useDerivAuth";
import { Footer } from "./Footer";
import { PwaInstallBanner, PwaInstallButton } from "./PwaInstall";

export function AuthScreen() {
  const { login, signUp, authState, error } = useDerivAuth();

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
            <p className="mt-1 text-xs text-muted-foreground">Sign in with your Deriv account</p>
          </div>

          <div className="rounded-xl border border-border bg-surface/40 p-6 shadow-2xl shadow-black/30">
            {error && (
              <div className="mb-4 rounded-md border border-bear/40 bg-bear/10 px-3 py-2 text-xs text-bear">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={login}
                disabled={authState === "authenticating"}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {authState === "authenticating" ? "Authenticating…" : "Log In with Deriv"}
              </button>
              
              <button
                type="button"
                onClick={signUp}
                disabled={authState === "authenticating"}
                className="w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent disabled:opacity-50"
              >
                Create Deriv Account
              </button>
            </div>
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
