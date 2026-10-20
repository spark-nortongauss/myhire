import { redirect } from "next/navigation";
import { Power } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";

async function LogoutButton() {
  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <form action={logout}>
      <Button variant="ghost" className="w-full justify-start gap-2">
        <Power size={16} />
        <span className="logout-label">Sair</span>
      </Button>
    </form>
  );
}

export default async function ProtectedLayout({
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
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    profile?.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "Minha conta";
  return (
    <AppShell name={name} logoutButton={<LogoutButton />}>
      {children}
    </AppShell>
  );
}
