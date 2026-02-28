import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data } = await supabase.from("job_applications").select("*").eq("id", params.id).eq("user_id", user!.id).maybeSingle();

  if (!data) return notFound();

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{data.job_title}</h1>
      <p className="text-sm text-muted-foreground">{data.company_name}</p>
      <div className="card">
        <h2 className="mb-2 font-semibold">Job description</h2>
        <p className="whitespace-pre-wrap text-sm">{data.job_description || "No description added yet."}</p>
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold">AI Insights</h2>
        <p className="whitespace-pre-wrap text-sm">{data.ai_insights || "No insights yet."}</p>
      </div>
    </div>
  );
}
