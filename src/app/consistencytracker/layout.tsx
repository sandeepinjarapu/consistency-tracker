import { redirect } from "next/navigation";
import TrackerNav from "@/components/tracker-nav";
import TimezoneSetter from "@/components/timezone-setter";
import { countUnseenShares } from "@/lib/actions/partners";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";

export default async function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, unseenShares] = await Promise.all([
    getCurrentProfile(),
    countUnseenShares(),
  ]);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-10">
      <TrackerNav badges={{ partners: unseenShares }} />
      {children}
      <TimezoneSetter current={profile?.timezone ?? "UTC"} />
    </div>
  );
}
