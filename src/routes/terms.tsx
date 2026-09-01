import { createFileRoute, Link } from "@tanstack/react-router";
import { Bullets, CONTACT_EMAIL, LegalLayout, Section } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <LegalLayout
      title="Terms and conditions"
      intro="These terms govern your use of the ThDpstSmrtTrdr application and website. By creating a profile or using the bot, you agree to them. If you do not agree, do not use the app."
    >
      <Section heading="1. What the service is">
        <p>
          ThDpstSmrtTrdr is software only. It connects to your own Deriv account using credentials
          you supply and places trades according to rules you configure. We are not a broker, not a
          financial services provider, not an asset manager and not a signal service. We do not hold
          your funds, we do not execute trades ourselves, and we have no control over prices,
          payouts, execution or your account with Deriv.
        </p>
      </Section>

      <Section heading="2. Eligibility">
        <Bullets
          items={[
            "You must be at least 18 years old.",
            "You must be legally permitted to trade derivatives in your country of residence.",
            "You must hold your own valid Deriv account and comply with Deriv's terms.",
            "You may not use the app on behalf of anyone else without their authority.",
          ]}
        />
      </Section>

      <Section heading="3. You trade at your own risk">
        <p>
          All trading decisions are yours. You choose the strategy, stake, repetition counts, stop
          loss, take profit and when the bot runs. You accept full responsibility for every trade
          placed through your account, including trades placed automatically by the bot while you
          are away from your device.
        </p>
        <p>
          See the <Link to="/risk" className="text-primary underline-offset-4 hover:underline">risk disclaimer</Link> for the full risk warning.
        </p>
      </Section>

      <Section heading="4. No guarantee of profit and no financial advice">
        <Bullets
          items={[
            "We do not guarantee profits, win rates, returns or any particular outcome.",
            "Past performance does not guarantee future results.",
            "Nothing in the app or on this website is financial, investment, legal or tax advice.",
            "Default settings, examples and strategy names are not recommendations.",
          ]}
        />
      </Section>

      <Section heading="5. Your account and credentials">
        <Bullets
          items={[
            "Keep your profile password and your Deriv API tokens confidential.",
            "You are responsible for all activity under your profile.",
            "Use tokens with the narrowest permissions you need, and revoke them in Deriv when you stop using the app.",
            "Tell us promptly at " + CONTACT_EMAIL + " if you believe your profile has been accessed without your permission.",
          ]}
        />
      </Section>

      <Section heading="6. Acceptable use">
        <Bullets
          items={[
            "Do not use the app for unlawful purposes, including market abuse or breaching Deriv's terms.",
            "Do not attempt to reverse engineer, resell, sublicense or copy the app without written permission.",
            "Do not interfere with the service, its infrastructure or other users.",
            "Do not use the app where doing so is prohibited by local law.",
          ]}
        />
      </Section>

      <Section heading="7. Availability and changes">
        <p>
          The service is provided on an "as is" and "as available" basis. We may change, suspend or
          discontinue features, and we do not promise uninterrupted or error-free operation.
          Third-party outages, including Deriv, hosting and push notification services, are outside
          our control.
        </p>
      </Section>

      <Section heading="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for any trading losses, lost
          profits, lost opportunity, missed trades, delayed or failed notifications, data loss, or
          any indirect, incidental, special or consequential damages arising from your use of the
          app. Where liability cannot lawfully be excluded, our total liability is limited to the
          amount you paid us for the service in the three months before the claim, or ZAR 0 if you
          paid nothing.
        </p>
        <p>
          Nothing in these terms limits liability for fraud, or for anything that cannot be limited
          under the Consumer Protection Act 68 of 2008 or other applicable South African law.
        </p>
      </Section>

      <Section heading="9. Indemnity">
        <p>
          You agree to indemnify us against claims, losses and costs arising from your breach of
          these terms, your breach of Deriv's terms, or your unlawful use of the app.
        </p>
      </Section>

      <Section heading="10. Termination">
        <p>
          You may stop using the app and delete your profile at any time. We may suspend or
          terminate access if you breach these terms or if we discontinue the service.
        </p>
      </Section>

      <Section heading="11. Governing law">
        <p>
          These terms are governed by the laws of the Republic of South Africa, and the South
          African courts have jurisdiction over any dispute.
        </p>
      </Section>

      <Section heading="12. Changes to these terms">
        <p>
          We may update these terms. The date at the top of this page shows when they last changed.
          Continued use after an update means you accept the updated terms.
        </p>
      </Section>

      <Section heading="13. Contact">
        <p>Questions about these terms: {CONTACT_EMAIL}</p>
      </Section>
    </LegalLayout>
  );
}
