import { createFileRoute } from "@tanstack/react-router";
import { Bullets, LegalLayout, Section } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/risk")({ component: RiskPage });

function RiskPage() {
  return (
    <LegalLayout
      title="Risk disclaimer"
      intro="Read this before you use ThDpstSmrtTrdr with a real money account. Trading derivatives is high risk and is not suitable for everyone."
    >
      <Section heading="You can lose all of your money">
        <Bullets
          items={[
            "Trading derivatives, including digit contracts on synthetic indices, carries a high level of risk.",
            "You can lose some or all of the money in your trading account, and you can lose it quickly.",
            "Only use money you can afford to lose entirely without affecting your living expenses or obligations.",
            "Never trade with borrowed money.",
          ]}
        />
      </Section>

      <Section heading="No guarantee of profit">
        <Bullets
          items={[
            "This software does not guarantee profits and makes no promise about any outcome.",
            "Past performance, whether shown in your own session history or anywhere else, does not guarantee or indicate future results.",
            "A run of winning trades can be followed by losing trades at any time.",
            "Results shown on a demo account do not predict results on a real account.",
          ]}
        />
      </Section>

      <Section heading="Automation risk">
        <Bullets
          items={[
            "The bot places trades automatically according to the rules you set. It can place losing trades.",
            "Internet loss, device sleep, browser limits, WebSocket disconnections or platform outages can delay or prevent trades, stop loss and take profit triggers, or notifications.",
            "Stop loss and take profit are applied by this software after trades settle. They are not broker-side guarantees and may be exceeded by an open position.",
            "Software can contain errors. Test with a demo account before risking real money.",
          ]}
        />
      </Section>

      <Section heading="No advice">
        <p>
          Nothing in this app or on this website is financial, investment, legal or tax advice. No
          strategy, default value or example is a recommendation. You decide whether to trade, what
          to trade, how much to stake and when to stop. If you are unsure, speak to a licensed
          financial adviser.
        </p>
      </Section>

      <Section heading="Your broker">
        <p>
          Your account, funds and executed trades are held and processed by Deriv, not by us. Deriv
          has its own terms, risk disclosures and account restrictions, and its own rules about
          which countries and account types it serves. You are responsible for complying with them
          and with the laws that apply to you.
        </p>
      </Section>
    </LegalLayout>
  );
}
