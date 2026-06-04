import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice · Consistency Tracker",
  description:
    "What Consistency Tracker stores, how it is used, and who can see it.",
};

// Public route (not under /consistencytracker), so it stays readable while
// logged out — the login page links here for sign-in consent.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <article className="mx-auto max-w-prose space-y-8 text-sm leading-relaxed">
        <header className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">Privacy notice</h1>
          <p className="text-[color:var(--muted)]">Last updated 4 June 2026.</p>
        </header>

        <p>
          Consistency Tracker is a calm, private place to track a few habits.
          This note explains, in plain language, what it stores, how that is
          used, and who can see it. No surprises.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-medium">What we store</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Your basic Google account details when you sign in: your name,
              email address, and profile photo.
            </li>
            <li>
              What you write in the app: your goals and why each one matters,
              your weekly reflections, your daily check-ins and any notes or
              skip reasons, and any partner invites you send or accept.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">How we use it</h2>
          <p>
            Only to run the app for you: to show your record back to you, to
            build your weekly reflection and the optional weekly email summary,
            and to share the specific goals you choose with the partners you
            invite. We do not sell your data, share it with advertisers, or use
            it to train anything.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Who can see it</h2>
          <p>
            Your entries are private by default. A partner can only see a goal
            after you explicitly share it with them, and a reflection only if
            you mark it as visible to partners. Other users can never see your
            data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Our access, honestly</h2>
          <p>
            Your data is stored in our database. As the people who run the
            service, we technically have access to it, the same as with any app
            you sign in to. We do not read your entries as a matter of practice,
            and we never sell them or use them for ads. If that level of trust
            is not right for something deeply private, please keep it out of the
            app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Services we rely on</h2>
          <p>
            We use a few trusted providers, each of which only receives what it
            needs to do its job: Google for sign-in, Supabase for the database
            and authentication, Vercel for hosting (its analytics is cookieless
            and does not track you across sites), and an email provider to send
            the weekly summary.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Cookies</h2>
          <p>
            We use a single sign-in cookie to keep you logged in. We do not use
            advertising or cross-site tracking cookies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Your choices</h2>
          <p>
            You can delete any goal, reflection, or check-in at any time. To
            delete your account and everything tied to it, email us and we will
            remove it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Changes</h2>
          <p>
            If this note changes in a meaningful way, we will update the date at
            the top.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Contact</h2>
          <p>
            Questions, or want your data removed? Email{" "}
            <a
              href="mailto:privacy@sixthsense.works"
              className="underline hover:text-black"
            >
              privacy@sixthsense.works
            </a>
            .
          </p>
        </section>

        <footer className="pt-4 border-t border-[color:var(--border)]">
          <Link
            href="/login"
            className="text-[color:var(--muted)] hover:text-black"
          >
            Back to sign in
          </Link>
        </footer>
      </article>
    </main>
  );
}
