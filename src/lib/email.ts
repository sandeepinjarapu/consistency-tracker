import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
