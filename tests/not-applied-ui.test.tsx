import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/use-cvs", () => ({ useCvs: () => ({ cvs: [], error: null }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobDetailsClient } from "@/components/jobs/job-details-client";

const job = {
  id: "00000000-0000-4000-8000-000000000001", user_id: "owner",
  job_title: "Country Operations Director", company_name: "Example",
  status: "not_applied", applied_at: null, created_at: "2026-10-20T12:00:00Z",
  job_url: "https://example.com/careers/1", ai_insights_json: {},
};

describe("discovered opportunities are visibly pending application", () => {
  it("shows a readable, highlighted label and a filter in the positions table", () => {
    const html = renderToStaticMarkup(<JobsTable initialData={[job]} userId="owner" />);
    expect(html).toContain('aria-label="Change status: Not Applied"');
    expect(html).toContain("not-applied-status");
    expect(html).toContain("<span>Not Applied</span>");
    expect(html).toContain('value="not_applied">Not Applied</option>');
  });
  it("shows the same pending label in job details, without an invented application date", () => {
    const html = renderToStaticMarkup(<JobDetailsClient data={job} />);
    expect(html).toContain("not-applied-status");
    expect(html).toContain(">Not Applied</span>");
    expect(html).not.toContain("Invalid Date");
  });
});
