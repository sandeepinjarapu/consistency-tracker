import Link from "next/link";
import { listPartners, listPendingInvites } from "@/lib/actions/partners";
import InviteForm from "@/components/invite-form";
import PendingInviteRow from "@/components/pending-invite-row";

export default async function PartnersPage() {
  const [partners, pending] = await Promise.all([
    listPartners(),
    listPendingInvites(),
  ]);

  return (
    <section className="space-y-12">
      <header>
        <h1 className="text-xl font-light tracking-tight">Partners</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Share specific goals with someone close. They see your consistency, you see theirs.
        </p>
      </header>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Invite someone
        </h2>
        <InviteForm />
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Pending invites
          </h2>
          <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
            {pending.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                id={inv.id}
                email={inv.invitee_email}
                url={inv.invite_url}
              />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Your partners
        </h2>
        {partners.length === 0 ? (
          <div className="border border-dashed border-[color:var(--border)] rounded-lg p-8 text-center">
            <p className="text-sm text-[color:var(--muted)]">
              No partners yet. Send an invite above to get started.
            </p>
          </div>
        ) : (
          <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
            {partners.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/consistencytracker/partners/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                    )}
                    <p className="text-sm font-medium">
                      {p.display_name ?? "Unnamed partner"}
                    </p>
                  </div>
                  <span className="text-xs text-[color:var(--muted)]">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
