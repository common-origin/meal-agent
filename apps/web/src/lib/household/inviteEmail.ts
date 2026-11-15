/** The household invite email (#217). */

import { INVITE_DAYS } from './members';

/** The invite email: who it's from, and the link. Plain enough to read as text too. */
export function inviteEmail(inviterEmail: string | undefined, joinUrl: string) {
  const from = inviterEmail ?? 'Someone';
  const subject = `${from} invited you to their household on Meal Agent`;
  const text =
    `${from} invited you to plan meals with their household on Meal Agent.\n\n` +
    `Join here: ${joinUrl}\n\n` +
    `Sign up or sign in with this email address. The link works for ${INVITE_DAYS} days. ` +
    `If you weren't expecting this, you can ignore it.`;
  const html =
    `<h2>Join ${escapeHtml(from)}'s household on Meal Agent</h2>` +
    `<p>${escapeHtml(from)} invited you to plan meals with their household.</p>` +
    `<p><a href="${escapeHtml(joinUrl)}">Join the household</a></p>` +
    `<p>Sign up or sign in with this email address. The link works for ${INVITE_DAYS} days. ` +
    `If you weren't expecting this, you can ignore it.</p>`;
  return { subject, text, html };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
