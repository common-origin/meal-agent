"use client";

import Link from "next/link";
import { Typography } from "@common-origin/design-system";
import LegalPage, { ContactLink, LegalList, LegalSection } from "@/components/app/LegalPage";

/** Public privacy policy (#213). Keep it true to what the code stores and sends. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="Meal Agent is a small, invite-only meal-planning app run by Common Origin in Australia. This page explains what it stores about you, who helps process it, and how to have it deleted."
    >
      <LegalSection title="What we store">
        <LegalList
          items={[
            "Your account: your email address, and your name and profile picture if you sign in with Google.",
            "Your household's settings: how many adults, children's ages, diet, allergies, foods to avoid, cuisines, city, budget and cooking preferences.",
            "What you plan: meal plans, recipes you generate or add, shopping lists and your pantry list.",
            "People you share recipes with: the names and email addresses you add in Settings.",
            "Coles orders, only if you install the Coles browser extension: the products in your orders from the last 12 months, used to match shopping lists to what you buy. Older orders are deleted automatically.",
            "A log of AI requests (which feature, when, and how much it used), to enforce daily limits. It doesn't contain your recipes or settings.",
            "Error logs (which page or feature failed, with no personal details), kept for 90 days.",
          ]}
        />
        <Typography variant="body">
          Usage statistics, favourites and ratings stay in your own browser and aren&apos;t sent to us. Photos you scan for your pantry or a recipe are
          read once and not stored.
        </Typography>
      </LegalSection>

      <LegalSection title="Who processes it">
        <Typography variant="body">We don&apos;t sell your data or use it for advertising. These services help run the app:</Typography>
        <LegalList
          items={[
            "Supabase: the database and sign-in, where everything above is stored.",
            "Google Gemini: writes recipes and reads pantry photos and recipe pages. It receives your household's settings, pantry and the photo or link involved, under Google's API terms.",
            "Google: sign-in, if you choose Continue with Google.",
            "Resend: sends sign-in links and the recipe emails you choose to send.",
            "Vercel: hosts the app.",
            "Coles product search (via RapidAPI): receives ingredient names to look up prices, nothing about you.",
          ]}
        />
        <Typography variant="body">Some of these services store data outside Australia.</Typography>
      </LegalSection>

      <LegalSection title="Who can see it">
        <Typography variant="body">
          Only members of your household can see your household&apos;s data in the app. We can access it to run and fix
          Meal Agent, and don&apos;t otherwise look at it. Your calendar link and Coles extension key work
          like passwords: anyone you give them to can see your meal plan, and you can replace them in Settings.
        </Typography>
      </LegalSection>

      <LegalSection title="Keeping and deleting it">
        <Typography variant="body">
          We keep your data while you have an account. You can download a copy of it, or delete your account, at any time
          in Settings → <Link href="/settings/data-export">Your data</Link>. Deleting removes your account straight away; if
          you&apos;re the only person in your household, its data goes too. If you can&apos;t sign in, email <ContactLink /> and
          we&apos;ll do it within 30 days.
        </Typography>
      </LegalSection>

      <LegalSection title="Questions and changes">
        <Typography variant="body">
          Email <ContactLink /> with any question about your data. If this policy changes in a way that matters, we&apos;ll
          update the date above and tell you in the app or by email.
        </Typography>
      </LegalSection>
    </LegalPage>
  );
}
