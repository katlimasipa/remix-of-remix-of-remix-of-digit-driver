import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Activity, Shield, Zap, TrendingUp } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navigation Bar */}
      <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <Link to="/">
              <img src="/logo-light.png" alt="ThDpstSmrtTrdr Logo" className="h-8 w-auto dark:hidden" />
              <img src="/logo-dark.png" alt="ThDpstSmrtTrdr Logo" className="h-8 w-auto hidden dark:block" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="flex min-h-[85vh] items-center justify-center pt-24 pb-12">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-primary mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2" />
              Automated Trading Engine 2.0
            </div>
            
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
              Precision Trading, <br />
              <span className="text-primary">
                Automated.
              </span>
            </h1>
            
            <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              Empower your portfolio with intelligent, pattern-matching algorithms. ThDpstSmrtTrdr analyzes ticks in milliseconds, executing logic flawlessly while you sleep.
            </p>
            
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/dashboard">
                <Button size="lg" className="group h-14 rounded-full px-8 text-base transition-transform hover:scale-105">
                  Start Trading Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="h-14 rounded-full px-8 text-base">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="bg-surface/30 py-24 sm:py-32 border-y border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Engineered for Edge</h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Built for traders who demand precision, speed, and uncompromising reliability.
              </p>
            </div>

            <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard 
                  icon={<Activity className="h-6 w-6 text-primary" />}
                  title="Pattern Recognition"
                  description="Wait for specific digit patterns (XXYYY) before entering trades to maximize probability."
                />
                <FeatureCard 
                  icon={<Zap className="h-6 w-6 text-primary" />}
                  title="Millisecond Execution"
                  description="Connects directly via WebSocket to ensure zero-latency tick processing and order execution."
                />
                <FeatureCard 
                  icon={<Shield className="h-6 w-6 text-primary" />}
                  title="Risk Management"
                  description="Built-in stop-loss, take-profit, and smart martingale multipliers protect your capital."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Section */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Deep Analytics & Session History</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                  Track every tick, every trade, and every profit with comprehensive session logging. Analyze your win rates and fine-tune your strategies on the fly with live charts and data.
                </p>
                <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Real-time PnL tracking
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Detailed trade logs with execution speeds
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Exportable session histories
                  </li>
                </ul>
              </div>
              <div className="relative">
                {/* Mockup of UI without glowing blobs */}
                <div className="rounded-xl border border-border bg-surface/50 p-2 shadow-sm">
                  <div className="rounded-lg border border-border bg-background p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-sm font-medium text-muted-foreground">Live Session</div>
                      <div className="text-xs text-bull bg-bull/10 px-2 py-1 rounded-full">+ $450.20</div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-xs font-mono">1HZ100V</span>
                          </div>
                          <span className="text-xs font-mono text-bull">+1.90</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-surface/30 border-t border-border py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready to automate?</h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Join the elite traders utilizing programmatic advantages. No setup required, just connect your account and let the algorithms take over.
            </p>
            <div className="mt-10">
              <Link to="/dashboard">
                <Button size="lg" className="h-14 rounded-full px-10 text-lg transition-transform hover:scale-105">
                  Launch Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-background p-8 transition-all hover:bg-surface/80 hover:shadow-sm">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
