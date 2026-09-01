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
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/20">
              <div className="h-3 w-3 rounded-sm bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">ThDpstSmrtTrdr</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-20">
          <div className="absolute inset-0 -z-10">
            <img 
              src="/hero_graphic.jpg" 
              alt="Abstract algorithmic trading" 
              className="h-full w-full object-cover opacity-30 mix-blend-screen"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          </div>

          <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              Automated Trading Engine 2.0
            </div>
            
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
              Precision Trading, <br />
              <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent filter drop-shadow-lg">
                Automated.
              </span>
            </h1>
            
            <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              Empower your portfolio with intelligent, pattern-matching algorithms. ThDpstSmrtTrdr analyzes ticks in milliseconds, executing logic flawlessly while you sleep.
            </p>
            
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/dashboard">
                <Button size="lg" className="group h-14 rounded-full px-8 text-base shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)] transition-all hover:scale-105">
                  Start Trading Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="h-14 rounded-full px-8 text-base border-white/10 hover:bg-white/5">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="bg-background py-24 sm:py-32 relative">
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
        <section className="relative overflow-hidden border-y border-white/5 bg-surface/30 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Deep Analytics & Session History</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                  Track every tick, every trade, and every profit with comprehensive session logging. Analyze your win rates and fine-tune your strategies on the fly with live charts and data.
                </p>
                <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/20 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Real-time PnL tracking
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/20 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Detailed trade logs with execution speeds
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/20 p-1"><TrendingUp className="h-4 w-4 text-primary" /></div>
                    Exportable session histories
                  </li>
                </ul>
              </div>
              <div className="relative">
                {/* Mockup of UI */}
                <div className="rounded-xl border border-white/10 bg-background/50 p-2 shadow-2xl backdrop-blur-sm">
                  <div className="rounded-lg border border-white/5 bg-surface p-6 shadow-inner">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-sm font-medium text-muted-foreground">Live Session</div>
                      <div className="text-xs text-bull bg-bull/10 px-2 py-1 rounded-full">+ $450.20</div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between border-b border-white/5 pb-3">
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
                {/* Decorative blobs */}
                <div className="absolute -left-4 -top-4 -z-10 h-32 w-32 rounded-full bg-primary/30 blur-[50px]" />
                <div className="absolute -bottom-4 -right-4 -z-10 h-32 w-32 rounded-full bg-purple-500/20 blur-[50px]" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Ready to automate?</h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Join the elite traders utilizing programmatic advantages. No setup required, just connect your account and let the algorithms take over.
            </p>
            <div className="mt-10">
              <Link to="/dashboard">
                <Button size="lg" className="h-14 rounded-full px-10 text-lg shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)] transition-transform hover:scale-105">
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
    <div className="group relative rounded-2xl border border-white/5 bg-surface/50 p-8 transition-all hover:bg-surface hover:shadow-xl hover:shadow-primary/5">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
