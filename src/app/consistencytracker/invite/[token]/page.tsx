import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import InviteAcceptButton from "@/components/invite-accept-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects to /login

  // Service-role lookup — the token is the proof of intent
  const service = createServiceClient();
  const { data: invite } = await service
    .from("partner_invites")
    .select("id, inviter_id, invitee_email, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (!invite) return <Notice title="Invite not found" body="This link is either incorrect or has been revoked." />;

  const expired = new Date(invite.expires_at) < new Date();
  if (expired) return <Notice title="Invite expired" body="This invite is more than 14 days old. Ask your partner for a fresh one." />;

  if (invite.accepted_at) {
    return (
      <Notice
        title="Already accepted"
        body="This invite has already been accepted."
        action={
          <Link
            href={`/consistencytracker/partners/${invite.inviter_id}`}
            className="text-sm underline hover:text-black"
          >
            Go to their tracker →
          </Link>
        }
      />
    );
  }

  if (invite.inviter_id === user.id) {
    return (
      <Notice
        title="That's your own invite"
        body="You can't accept an invite you sent. Share the link with the person you want to invite."
      />
    );
  }

  const { data: inviter } = await service
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", invite.inviter_id)
    .single();

  const inviterName = inviter?.display_name ?? "Someone";

  return (
    <section className="max-w-md mx-auto pt-8">
      <div className="text-center mb-8">
        {inviter?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inviter.avatar_url}
            alt=""
            className="w-16 h-16 rounded-full mx-auto mb-4"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-4" />
        )}
        <h1 className="text-xl font-light tracking-tight">
          {inviterName} invited you
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Once you accept, you&apos;ll be able to see the goals they choose to share with you — and they can see yours.
        </p>
      </div>

      <InviteAcceptButton token={token} />

      <p className="mt-6 text-xs text-[color:var(--muted)] text-center">
        Not the right person? Just close this tab — nothing happens until you accept.
      </p>
    </section>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="max-w-md mx-auto pt-12 text-center space-y-4">
      <h1 className="text-xl font-light tracking-tight">{title}</h1>
      <p className="text-sm text-[color:var(--muted)]">{body}</p>
      {action ?? (
        <Link
          href="/consistencytracker"
          className="text-sm underline hover:text-black"
        >
          Back to tracker
        </Link>
      )}
    </section>
  );
}
