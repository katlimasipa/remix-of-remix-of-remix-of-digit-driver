import { useState } from "react";
import { Download, MoreVertical, Share, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { getInstallBrowserHint, type InstallBrowserHint } from "@/lib/pwa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function InstallSteps({ hint }: { hint: InstallBrowserHint }) {
  const steps: Record<InstallBrowserHint, string[]> = {
    "chrome-android": [
      "Tap the ⋮ menu in the top-right of Chrome.",
      'Choose "Install app" or "Add to Home screen".',
      'Tap "Install" to add SmrtTrdr to your home screen.',
    ],
    samsung: [
      "Tap the menu icon (☰ or ⋮) in Samsung Internet.",
      'Select "Add page to" → "Home screen".',
      "Confirm to install the app.",
    ],
    "firefox-android": [
      "Tap the ⋮ menu in Firefox.",
      'Choose "Install" or "Add to Home screen".',
      "Confirm the installation.",
    ],
    "ios-safari": [
      "Tap the Share button at the bottom of Safari.",
      'Scroll and tap "Add to Home Screen".',
      'Tap "Add" to install SmrtTrdr.',
    ],
    "desktop-chrome": [
      "Click the install icon in the address bar (⊕ or monitor icon).",
      'Or open the browser menu (⋮) and choose "Install SmrtTrdr…".',
      "Confirm to add the app to your device.",
    ],
    generic: [
      "Open your browser menu (usually ⋮ or ☰).",
      'Look for "Install app", "Add to Home screen", or "Install".',
      "Follow the prompts to add SmrtTrdr.",
    ],
  };

  return (
    <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
      {steps[hint].map((step, i) => (
        <li key={i} className="flex gap-2">
          <span className="font-mono text-xs text-primary shrink-0">{i + 1}.</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

type PwaInstallButtonProps = {
  className?: string;
  showLabel?: boolean;
};

export function PwaInstallButton({ className = "", showLabel = true }: PwaInstallButtonProps) {
  const { canInstall, canNativeInstall, installing, install } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const hint = getInstallBrowserHint();

  if (!canInstall) return null;

  async function handleClick() {
    if (canNativeInstall) {
      const accepted = await install();
      if (!accepted) setInstructionsOpen(true);
    } else {
      setInstructionsOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className={
          className ||
          "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        }
        title="Install app on your device"
      >
        <Download className="h-3.5 w-3.5" />
        {showLabel && (
          <span className="hidden sm:inline">{installing ? "Installing…" : "Install"}</span>
        )}
      </button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install SmrtTrdr</DialogTitle>
            <DialogDescription>
              Install to open SmrtTrdr full-screen without the Chrome browser bar. You also get
              faster launch and push notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              {hint === "ios-safari" ? (
                <Share className="h-4 w-4 text-primary" />
              ) : (
                <MoreVertical className="h-4 w-4 text-primary" />
              )}
              <span>From your browser menu</span>
            </div>
            <InstallSteps hint={hint} />
          </div>
          {canNativeInstall && (
            <button
              type="button"
              onClick={async () => {
                const accepted = await install();
                if (accepted) setInstructionsOpen(false);
              }}
              disabled={installing}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {installing ? "Installing…" : "Install now"}
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type PwaInstallBannerProps = {
  /** Leave space above the mobile tab bar (dashboard). */
  aboveNav?: boolean;
};

export function PwaInstallBanner({ aboveNav = false }: PwaInstallBannerProps) {
  const { canInstall, canNativeInstall, installing, install, showBanner, dismissBanner } =
    usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const hint = getInstallBrowserHint();

  if (!canInstall || !showBanner) return null;

  const bottomClass = aboveNav
    ? "bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)]"
    : "bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]";

  async function handleInstall() {
    if (canNativeInstall) {
      const accepted = await install();
      if (!accepted) setInstructionsOpen(true);
    } else {
      setInstructionsOpen(true);
    }
  }

  return (
    <>
      <div
        className={`fixed ${bottomClass} inset-x-3 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm`}
      >
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-surface/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/90">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/15">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Install SmrtTrdr</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Install to remove the Chrome bar and run SmrtTrdr like a native app.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {installing ? "Installing…" : canNativeInstall ? "Install" : "How to install"}
              </button>
              <button
                type="button"
                onClick={() => setInstructionsOpen(true)}
                className="rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Browser menu
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss install banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install from browser menu</DialogTitle>
            <DialogDescription>
              If the install button does not appear, use your browser&apos;s built-in option.
            </DialogDescription>
          </DialogHeader>
          <InstallSteps hint={hint} />
        </DialogContent>
      </Dialog>
    </>
  );
}
