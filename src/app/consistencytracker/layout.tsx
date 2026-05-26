import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TrackerNav from "@/components/tracker-nav";
import TimezoneSetter from "@/components/timezone-setter";
import { countUnseenShares } from "@/lib/actions/partners";

export default async function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, unseenShares] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
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
