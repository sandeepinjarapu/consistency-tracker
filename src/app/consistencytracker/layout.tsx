import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TrackerNav from "@/components/tracker-nav";
import TimezoneSetter from "@/components/timezone-setter";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-10">
      <TrackerNav />
      {children}
      <TimezoneSetter current={profile?.timezone ?? "UTC"} />
    </div>
  );
}
