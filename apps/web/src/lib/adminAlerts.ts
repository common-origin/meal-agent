/**
 * Emails to the owner (ADMIN_EMAILS) when a shared limit is reached: the
 * day's AI spend ceiling (#215) and the month's Coles lookups (#227).
 * Server only.
 */

import { after } from 'next/server';
import { Resend } from 'resend';
import { adminEmails } from '@/lib/auth/admin';

/**
 * `after()` only works inside a request; elsewhere (scripts, tests) run the
 * work in the background instead. Failures are warned about, never thrown.
 */
export function runAfterResponse(work: () => Promise<void>): void {
  const safeWork = () =>
    work().catch((error) => console.warn('background work after the response failed', error));
  try {
    after(safeWork);
  } catch {
    void safeWork();
  }
}

/**
 * Emails ADMIN_EMAILS through Resend after the response. If email isn't
 * configured, only warns. If sending fails, calls `onFailure` (so the caller
 * can try again on its next alert) and warns.
 */
export function emailAdmins(message: { subject: string; text: string; onFailure?: () => void }): void {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  const to = adminEmails();
  if (!apiKey || !from || to.length === 0) {
    console.warn(`${message.subject}: RESEND_API_KEY, RESEND_FROM_ADDRESS or ADMIN_EMAILS is unset, so no email was sent`);
    return;
  }
  runAfterResponse(async () => {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: message.subject, text: message.text });
    if (error) {
      message.onFailure?.();
      throw new Error(error.message);
    }
  });
}
