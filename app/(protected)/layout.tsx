import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

async function LogoutButton() {
  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <form action={logout}>
      <Button variant="ghost" className="w-full justify-start">
        Logout
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r border-border bg-white p-4">
        <h2 className="text-xl font-bold">MyHire</h2>
        <nav className="mt-6 space-y-2">
          <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/dashboard">
            Dashboard
          </Link>
          <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/jobs">
            My Jobs
          </Link>
          <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/settings">
            Settings
          </Link>
          <LogoutButton />
        </nav>
      </aside>
      <section className="flex-1 p-6">{children}</section>
    </div>
  );
}
