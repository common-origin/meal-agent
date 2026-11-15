"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Stack, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";

/** Who to write to about privacy, terms or deleting an account (#213). */
export const LEGAL_CONTACT_EMAIL = "ollie@commonorigin.studio";

/** When /privacy and /terms last changed in substance. Update it with them. */
export const LEGAL_LAST_UPDATED = "15 November 2026";

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack direction="column" gap="sm">
      <Typography variant="h2">{title}</Typography>
      {children}
    </Stack>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "1.25em", display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((item, i) => (
        <li key={i}>
          <Typography variant="body">{item}</Typography>
        </li>
      ))}
    </ul>
  );
}

export function ContactLink() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}

/**
 * The frame for /privacy and /terms: public pages, outside the proxy, so
 * Google's consent screen and people who haven't signed up can read them.
 */
export default function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Main maxWidth="md">
      <Stack direction="column" gap="2xl">
        <Stack direction="column" gap="sm">
          <Typography variant="h1">{title}</Typography>
          <Typography variant="small" color="subdued">
            Last updated {LEGAL_LAST_UPDATED}
          </Typography>
          <Typography variant="body">{intro}</Typography>
        </Stack>
        {children}
        <Typography variant="small" color="subdued">
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/">Meal Agent</Link>
        </Typography>
      </Stack>
    </Main>
  );
}
