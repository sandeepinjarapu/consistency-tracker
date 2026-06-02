import { redirect } from "next/navigation";
import TrackerNav from "@/components/tracker-nav";
import TimezoneSetter from "@/components/timezone-setter";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";

export default async function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-10">
      <TrackerNav />
      {children}
      <TimezoneSetter current={profile?.timezone ?? "UTC"} />
    </div>
  );
}
