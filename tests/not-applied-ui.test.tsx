import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/use-cvs", () => ({ useCvs: () => ({ cvs: [], error: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobDetailsClient } from "@/components/jobs/job-details-client";
import { isActiveJob, statusLabels } from "@/lib/workspace/types";
const job = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "owner",
  job_title: "Country Operations Director",
  company_name: "Example",
  status: "not_applied",
  applied_at: null,
  created_at: "2026-10-20T12:00:00Z",
  job_url: "https://example.com/careers/1",
  ai_insights_json: {},
};
describe("discovered opportunities remain visibly pending application", () => {
  it("shows a readable highlighted label in the minimal table", () => {
    const html = renderToStaticMarkup(
      <JobsTable
        initialData={[job]}
        userId="owner"
        interviews={[]}
        actions={[]}
      />,
    );
    expect(html).toContain("not-applied-status");
    expect(html).toContain("Not Applied</span>");
    expect(statusLabels.not_applied).toBe("Not Applied");
  });
  it("does not invent application dates in job details", () => {
    const html = renderToStaticMarkup(
      <JobDetailsClient
        data={job}
        workspace={{ interviews: [], actions: [], stories: [], links: [] }}
        prepId={null}
        events={[]}
      />,
    );
    expect(html).toContain("not-applied-status");
    expect(html).toContain("Not Applied</span>");
    expect(html).toContain("Ainda não aplicada");
    expect(html).not.toContain("Invalid Date");
  });
  it("does not count discovered jobs as active applications", () => {
    expect(isActiveJob(job)).toBe(false);
    expect(isActiveJob({ ...job, status: "interview" })).toBe(true);
  });
});
