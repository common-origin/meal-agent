"use client";

import Link from "next/link";
import { Typography } from "@common-origin/design-system";
import LegalPage, { ContactLink, LegalSection } from "@/components/app/LegalPage";

/** Public terms of service (#213). */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="Meal Agent is a free, invite-only app run by Common Origin in Australia. By using it you agree to these terms."
    >
      <LegalSection title="Check recipes for allergens">
        <Typography variant="body">
          Recipes are written by AI and can be wrong. Meal Agent checks generated recipes against the allergies in your
          settings, but that check can miss things. Always read the ingredients, and the labels on what you buy, before
          cooking for anyone with an allergy or intolerance. Meal Agent doesn&apos;t give medical or dietary advice.
        </Typography>
      </LegalSection>

      <LegalSection title="Prices are estimates">
        <Typography variant="body">
          Costs are estimated from Coles prices that may be out of date or matched to a different product. What you pay at
          the checkout is what counts.
        </Typography>
      </LegalSection>

      <LegalSection title="Your account">
        <Typography variant="body">
          Use the email you were invited with, and keep your sign-in, calendar link and Coles extension key to yourself.
          Use Meal Agent for your own household, and don&apos;t try to get around its limits or reach other people&apos;s data.
          We may suspend an account that does.
        </Typography>
      </LegalSection>

      <LegalSection title="Provided as is">
        <Typography variant="body">
          Meal Agent is provided as is, without any guarantee that it will be available, accurate or suit you. It may
          change or stop. As far as the law allows, we aren&apos;t liable for loss arising from using it. Nothing here
          limits rights you have under Australian Consumer Law.
        </Typography>
      </LegalSection>

      <LegalSection title="Your data">
        <Typography variant="body">
          How we handle your data is in the <Link href="/privacy">privacy policy</Link>. You can stop using Meal Agent at
          any time and ask us to delete your account.
        </Typography>
      </LegalSection>

      <LegalSection title="Contact">
        <Typography variant="body">
          Questions about these terms: <ContactLink />. If they change in a way that matters, we&apos;ll update the date
          above and tell you.
        </Typography>
      </LegalSection>
    </LegalPage>
  );
}
