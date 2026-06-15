import { Resend } from "resend";

// Lazy-initialized so the module can be imported in builds / CI without
// RESEND_API_KEY set. The Resend constructor validates the key at call
// time; deferring it means only code paths that actually send mail
// require the env var to be present.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
    // Resend SDK v4+ returns { data, error } instead of throwing on API errors.
    const { error } = await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterName} invited you to Consistency Tracker`,
      html: inviteHtml({ inviterName, inviteUrl }),
      text: inviteText({ inviterName, inviteUrl }),
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}` };
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

export type ReflectionSummary = {
  continueText?: string | null;
  stopText?: string | null;
  improveText?: string | null;
  notes?: string | null;
};

export type WeeklyGoalStat = {
  name: string;
  done: number; // scored toward target (capped); never exceeds target
  target: number;
  skipped: number;
  extra: number; // extra check-ins beyond schedule/quota — evidence, not scored
};

/**
 * Send a weekly partner-summary email: how the owner did on their shared
 * goals over the past week. One email per (viewer, owner) pair.
 */
export async function sendWeeklySummary({
  to,
  cc,
  ownerName,
  ownerId,
  weekLabel,
  goals,
  reflection,
  self = false,
}: {
  to: string;
  cc?: string;
  ownerName: string;
  ownerId: string;
  weekLabel: string;
  goals: WeeklyGoalStat[];
  /** Partner-visible reflection for this week, if one exists. */
  reflection?: ReflectionSummary;
  /** True when the recipient is the goal owner (self-summary). */
  self?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (goals.length === 0) return { ok: true };
  try {
    // Resend SDK v4+ returns { data, error } instead of throwing on API errors.
    const { error } = await getResend().emails.send({
      from: FROM,
      to,
      ...(cc ? { cc } : {}),
      subject: weeklySubject(ownerName, goals, self),
      html: weeklyHtml({ ownerName, ownerId, weekLabel, goals, reflection, self }),
      text: weeklyText({ ownerName, ownerId, weekLabel, goals, reflection, self }),
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function weeklySubject(
  ownerName: string,
  goals: WeeklyGoalStat[],
  self: boolean
): string {
  const totalDone = goals.reduce((s, g) => s + g.done, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const who = self ? "Your" : `${ownerName}'s`;
  return `${who} week — ${totalDone} of ${totalTarget} done`;
}

function weeklyHtml({
  ownerName,
  ownerId,
  weekLabel,
  goals,
  reflection,
  self,
}: {
  ownerName: string;
  ownerId: string;
  weekLabel: string;
  goals: WeeklyGoalStat[];
  reflection?: ReflectionSummary;
  self: boolean;
}): string {
  const ctaUrl = self
    ? `${SITE}/consistencytracker`
    : `${SITE}/consistencytracker/partners/${ownerId}`;
  const heading = self ? "Your week" : `${escapeHtml(ownerName)}'s week`;
  const ctaLabel = self ? "Open your tracker" : "See their tracker";
  const rows = goals
    .map((g) => {
      const pct = g.target > 0 ? Math.round((g.done / g.target) * 100) : 0;
      const extra = g.extra > 0 ? ` <span style="color:#6b7280;">· +${g.extra} extra</span>` : "";
      const skipped = g.skipped > 0 ? ` <span style="color:#92400e;">· ${g.skipped} skipped</span>` : "";
      return `<tr>
        <td style="padding: 6px 12px 6px 0; font-size: 14px; color: #0a0a0a;">${escapeHtml(g.name)}</td>
        <td style="padding: 6px 0; font-size: 14px; color: #374151; text-align: right; white-space: nowrap;">${g.done} / ${g.target} this week <span style="color:#9ca3af;">· ${pct}%</span>${extra}${skipped}</td>
      </tr>`;
    })
    .join("");

  const reflectionFields: Array<{ label: string; text: string }> = [];
  if (reflection) {
    if (reflection.continueText?.trim()) reflectionFields.push({ label: "Keep", text: reflection.continueText.trim() });
    if (reflection.stopText?.trim()) reflectionFields.push({ label: "Let go", text: reflection.stopText.trim() });
    if (reflection.improveText?.trim()) reflectionFields.push({ label: "Try next", text: reflection.improveText.trim() });
    if (reflection.notes?.trim()) reflectionFields.push({ label: "Notes", text: reflection.notes.trim() });
  }
  const reflectionHtml = reflectionFields.length > 0
    ? `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 16px;">In their own words</p>
    ${reflectionFields
      .map(
        (f) =>
          `<p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 4px;">${escapeHtml(f.label)}</p>
    <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(f.text)}</p>`
      )
      .join("")}`
    : "";

  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0a0a0a; padding: 24px; max-width: 520px; margin: 0 auto;">
    <h1 style="font-weight: 300; font-size: 20px; margin: 0 0 4px;">${heading}</h1>
    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 20px;">${escapeHtml(weekLabel)}</p>
    <table style="width: 100%; border-collapse: collapse;">${rows}</table>
    ${reflectionHtml}
    <p style="margin: 28px 0 8px;">
      <a href="${ctaUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">${ctaLabel}</a>
    </p>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 24px;">
      Sent once a week (Mondays). You can manage partners in the app.
    </p>
  </body>
</html>`;
}

function weeklyText({
  ownerName,
  ownerId,
  weekLabel,
  goals,
  reflection,
  self,
}: {
  ownerName: string;
  ownerId: string;
  weekLabel: string;
  goals: WeeklyGoalStat[];
  reflection?: ReflectionSummary;
  self: boolean;
}): string {
  const ctaUrl = self
    ? `${SITE}/consistencytracker`
    : `${SITE}/consistencytracker/partners/${ownerId}`;
  const lines = goals.map((g) => {
    const pct = g.target > 0 ? Math.round((g.done / g.target) * 100) : 0;
    const extra = g.extra > 0 ? ` (+${g.extra} extra)` : "";
    const skipped = g.skipped > 0 ? ` (${g.skipped} skipped)` : "";
    return `  • ${g.name}: ${g.done}/${g.target} this week · ${pct}%${extra}${skipped}`;
  });

  const reflectionLines: string[] = [];
  if (reflection) {
    const fields: Array<{ label: string; text: string | null | undefined }> = [
      { label: "Keep", text: reflection.continueText },
      { label: "Let go", text: reflection.stopText },
      { label: "Try next", text: reflection.improveText },
      { label: "Notes", text: reflection.notes },
    ];
    const filled = fields.filter((f) => f.text?.trim());
    if (filled.length > 0) {
      reflectionLines.push("---", "", "In their own words:", "");
      for (const f of filled) {
        reflectionLines.push(f.label, f.text!.trim(), "");
      }
    }
  }

  return [
    `${self ? "Your" : `${ownerName}'s`} week (${weekLabel}):`,
    "",
    ...lines,
    "",
    ...reflectionLines,
    `${self ? "Open your tracker" : "See their tracker"}: ${ctaUrl}`,
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
