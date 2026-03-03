import { redirect } from "next/navigation";
import { Power } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/ui/page-transition";

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
        <span className="logout-label">Logout</span>
      </Button>
    </form>
  );
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AppShell logoutButton={<LogoutButton />}><PageTransition>{children}</PageTransition></AppShell>;
}
