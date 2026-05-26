import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function sendInviteEmail({
  to,
  inviterName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `${inviterName} invited you to Consistency Tracker`,
      html: inviteHtml({ inviterName, inviteUrl }),
      text: inviteText({ inviterName, inviteUrl }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function inviteHtml({
  inviterName,
  inviteUrl,
}: {
  inviterName: string;
  inviteUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0a0a0a; padding: 24px; max-width: 480px; margin: 0 auto;">
    <h1 style="font-weight: 300; font-size: 22px; margin: 0 0 16px;">You've been invited</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      <strong>${escapeHtml(inviterName)}</strong> wants to share their consistency tracker with you so you can see each other's progress and keep each other honest.
    </p>
    <p style="margin: 24px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-size: 14px;">Accept invite</a>
    </p>
    <p style="font-size: 12px; color: #6b7280;">
      Or paste this URL into your browser:<br>
      <span style="word-break: break-all;">${inviteUrl}</span>
    </p>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 32px;">
      This invite expires in 14 days. If you weren't expecting it, you can ignore this email.
    </p>
  </body>
</html>`;
}

function inviteText({
  inviterName,
  inviteUrl,
}: {
  inviterName: string;
  inviteUrl: string;
}): string {
  return `${inviterName} invited you to Consistency Tracker.\n\nAccept here: ${inviteUrl}\n\n(This invite expires in 14 days.)`;
}

/**
 * Send a "{Owner} shared N new goals with you today" digest. Batches all
 * new shares from one owner into one email so we don't spam the viewer.
 */
export async function sendShareDigest({
  to,
  ownerName,
  ownerId,
  goalNames,
}: {
  to: string;
  ownerName: string;
  ownerId: string;
  goalNames: string[];
}): Promise<{ ok: boolean; error?: string }> {
  if (goalNames.length === 0) return { ok: true };
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: subjectFor(ownerName, goalNames.length),
      html: digestHtml({ ownerName, ownerId, goalNames }),
      text: digestText({ ownerName, ownerId, goalNames }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function subjectFor(ownerName: string, count: number): string {
  return count === 1
    ? `${ownerName} shared a goal with you`
    : `${ownerName} shared ${count} goals with you`;
}

function digestHtml({
  ownerName,
  ownerId,
  goalNames,
}: {
  ownerName: string;
  ownerId: string;
  goalNames: string[];
}): string {
  const partnerUrl = `${SITE}/consistencytracker/partners/${ownerId}`;
  const items = goalNames
    .map((n) => `<li style="margin: 4px 0;">${escapeHtml(n)}</li>`)
    .join("");
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0a0a0a; padding: 24px; max-width: 480px; margin: 0 auto;">
    <h1 style="font-weight: 300; font-size: 20px; margin: 0 0 16px;">
      ${escapeHtml(ownerName)} ${goalNames.length === 1 ? "shared a new goal" : `shared ${goalNames.length} new goals`} with you
    </h1>
    <ul style="font-size: 14px; line-height: 1.6; color: #374151; padding-left: 20px; margin: 16px 0;">
      ${items}
    </ul>
    <p style="margin: 24px 0;">
      <a href="${partnerUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">View their tracker</a>
    </p>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 32px;">
      You're getting this because you're partnered with ${escapeHtml(ownerName)} on Consistency Tracker. Digests are sent at most once a day.
    </p>
  </body>
</html>`;
}

function digestText({
  ownerName,
  ownerId,
  goalNames,
}: {
  ownerName: string;
  ownerId: string;
  goalNames: string[];
}): string {
  const partnerUrl = `${SITE}/consistencytracker/partners/${ownerId}`;
  return [
    `${ownerName} ${goalNames.length === 1 ? "shared a new goal" : `shared ${goalNames.length} new goals`} with you:`,
    "",
    ...goalNames.map((n) => `  • ${n}`),
    "",
    `View their tracker: ${partnerUrl}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
