import { redirect } from "next/navigation";
// Some email configurations fall back to Site URL instead of the callback path.
export default function HomePage({
  searchParams,
}: {
  searchParams?: { code?: string; error?: string };
}) {
  if (searchParams?.code)
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  if (searchParams?.error) redirect("/login?error=link");
  redirect("/dashboard");
}
