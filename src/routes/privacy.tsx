import { createFileRoute } from "@tanstack/react-router";
import { Bullets, CONTACT_EMAIL, LegalLayout, Section } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy"
      intro="This policy explains how ThDpstSmrtTrdr collects, uses and protects your personal information, in line with the Protection of Personal Information Act 4 of 2013 (POPIA)."
    >
      <Section heading="Who is responsible">
        <p>
          The operator of ThDpstSmrtTrdr is the responsible party for the personal information
          described here. You can reach the information officer at {CONTACT_EMAIL}.
        </p>
      </Section>

      <Section heading="What we collect">
        <Bullets
          items={[
            "Account details: the email address and password you use to create a profile. Passwords are stored hashed by our authentication provider, never in plain text.",
            "Deriv connection details: the Deriv API token or authorisation token you supply, and the account type (demo or real) and login ID you select. These are stored so you do not have to re-enter them.",
            "Trading session data: profit and loss, wins, losses, trade counts, repetitions and the strategy settings for sessions you save.",
            "Notification data: web push subscription details for each device you enable notifications on (endpoint and browser-generated keys).",
            "Technical data needed to run the service, such as basic request and error logs from our hosting and backend providers.",
          ]}
        />
        <p>
          We do not collect your identity documents, your bank details or your Deriv account
          balance history. We do not sell personal information and we do not use it for third-party
          advertising.
        </p>
      </Section>

      <Section heading="Why we process it (purpose and lawful basis)">
        <Bullets
          items={[
            "To create and secure your profile, and to sign you in - necessary to perform our agreement with you.",
            "To connect to Deriv and run the bot with the settings you choose - necessary to perform our agreement with you.",
            "To show your session history across your devices - necessary to perform our agreement with you.",
            "To send push notifications about bot status and trade results - based on the consent you give when you enable notifications in the app.",
            "To keep the service secure and to fix faults - our legitimate interest in operating a safe service.",
          ]}
        />
      </Section>

      <Section heading="Consent and choices">
        <Bullets
          items={[
            "Notifications are optional. You can turn them off in the app or in your browser or device settings at any time.",
            "You can remove your stored Deriv token from your profile at any time, and revoke it in your Deriv account.",
            "You can ask us to delete your profile and its data.",
          ]}
        />
      </Section>

      <Section heading="Who we share it with (operators)">
        <p>
          We use third-party service providers who process data on our behalf under confidentiality
          obligations:
        </p>
        <Bullets
          items={[
            "Our backend and authentication provider, which stores your profile, saved tokens, saved sessions and push subscriptions.",
            "Our hosting provider, which serves the website and the notification endpoint.",
            "The push messaging services operated by your browser or device vendor, which deliver notifications to your device.",
            "Deriv, which receives your trade instructions and returns market and contract data. Deriv is a separate controller of your Deriv account data under its own privacy policy.",
          ]}
        />
        <p>
          Some of these providers process data outside South Africa. Where that happens, we rely on
          providers that are subject to data protection laws or contractual safeguards providing
          comparable protection, as required by section 72 of POPIA.
        </p>
      </Section>

      <Section heading="Security">
        <Bullets
          items={[
            "Data is transmitted over encrypted connections (HTTPS and secure WebSockets).",
            "Database access is restricted by row level security so that your rows are only readable and writable by your own authenticated profile.",
            "Passwords are hashed by the authentication provider.",
            "No system is perfectly secure. Use a strong, unique password and keep your Deriv token private.",
          ]}
        />
      </Section>

      <Section heading="How long we keep it">
        <p>
          We keep your profile, saved tokens and session history for as long as your profile exists.
          Push subscriptions are kept until you disable notifications or the subscription expires.
          When you ask us to delete your profile, we delete the associated records, except where we
          must keep something to comply with a legal obligation.
        </p>
      </Section>

      <Section heading="Your rights under POPIA">
        <Bullets
          items={[
            "Access: ask what personal information we hold about you.",
            "Correction: ask us to correct information that is inaccurate or out of date.",
            "Deletion: ask us to delete or destroy your information where we no longer have grounds to keep it.",
            "Objection: object to processing based on legitimate interest.",
            "Withdraw consent: switch off notifications at any time, without affecting processing already carried out.",
            "Complain: lodge a complaint with the Information Regulator (South Africa) at inforegulator.org.za if you believe your rights have been infringed.",
          ]}
        />
        <p>To exercise any of these rights, email {CONTACT_EMAIL}.</p>
      </Section>

      <Section heading="Children">
        <p>
          The app is not intended for anyone under 18 and we do not knowingly collect personal
          information from children.
        </p>
      </Section>

      <Section heading="Cookies and local storage">
        <p>
          We use browser storage to keep you signed in, to remember your theme choice and your bot
          settings, and to cache the app for offline use through a service worker. We do not use
          advertising or third-party tracking cookies.
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p>
          We may update this policy. The date at the top of this page shows when it last changed.
        </p>
      </Section>
    </LegalLayout>
  );
}
