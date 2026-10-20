import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseLegacyCvs, toCvVersion } from "@/lib/cvs";
import { computeJobMatch } from "@/lib/job-finder/match";

const owner = "11111111-1111-4111-8111-111111111111";
const cvId = "22222222-2222-4222-8222-222222222222";
const searchId = "33333333-3333-4333-8333-333333333333";
const state = vi.hoisted(() => ({ authenticated: true, cvFound: true, providerFails: false, writes: [] as { table: string; operation: string; data: any }[], filters: [] as { table: string; key: string; value: unknown }[], provider: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.authenticated ? { id: "11111111-1111-4111-8111-111111111111" } : null } }) },
  from: (table: string) => {
    const result = () => ({ data: table === "user_cvs" ? state.cvFound ? { id: "22222222-2222-4222-8222-222222222222", parsed_text: "cloud operations director", parsed_skills: ["leadership"] } : null : { id: "33333333-3333-4333-8333-333333333333" }, error: null });
    const query: any = {
      select: () => query, order: () => query,
      eq: (key: string, value: unknown) => { state.filters.push({ table, key, value }); return query; },
      insert: (data: any) => { state.writes.push({ table, operation: "insert", data }); return query; },
      upsert: (data: any) => { state.writes.push({ table, operation: "upsert", data }); return query; },
      update: (data: any) => { state.writes.push({ table, operation: "update", data }); return query; },
      single: async () => result(), maybeSingle: async () => result(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve)
    }; return query;
  }
}) }));
vi.mock("@/lib/job-finder/rapidapi", async (original) => {
  const actual = await original<typeof import("@/lib/job-finder/rapidapi")>();
  return { ...actual, fetchRapidApiJobs: state.provider };
});
import { POST as search } from "@/app/api/job-finder/search/route";
import { POST as overdue } from "@/app/api/overdue/route";
import { POST as createCv } from "@/app/api/cvs/route";

beforeEach(() => {
  state.authenticated = true; state.cvFound = true; state.writes = []; state.filters = [];
  state.provider.mockReset(); state.provider.mockResolvedValue([{ jobIdExternal: "job-1", jobTitle: "Cloud operations director", jobDescription: "Leadership", rawPayload: {} }]);
  vi.stubEnv("RAPIDAPI_KEY", "test-only"); vi.stubEnv("RAPIDAPI_HOST", "test-only");
});
const request = (body: unknown) => new Request("https://example.com/api/job-finder/search", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("job finder contract and authorization", () => {
  it("uses persisted CV, current DB columns, ownership and completed status", async () => {
    const response = await search(request({ cvId, roleKeywords: "Director", location: "Paris", excludeJobPublishers: "foo, bar", cvSummary: "untrusted spoof" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ searchId, totalResults: 1 });
    const insert = state.writes.find((write) => write.table === "job_finder_searches" && write.operation === "insert")!.data;
    expect(insert).toMatchObject({ user_id: owner, cv_id: cvId, keywords: "Director", generated_query: "Director in Paris", exclude_job_publishers: ["foo", "bar"], status: "processing" });
    expect(insert).not.toHaveProperty("query");
    const results = state.writes.find((write) => write.table === "job_finder_results")!.data;
    expect(results[0]).toMatchObject({ user_id: owner, search_id: searchId, match_score: 100 });
    expect(state.filters).toContainEqual({ table: "user_cvs", key: "user_id", value: owner });
    expect(state.writes.at(-1)?.data).toMatchObject({ status: "completed", total_results: 1 });
  });
  it("blocks unauthenticated requests", async () => {
    state.authenticated = false;
    expect((await search(request({ cvId, roleKeywords: "Director" }))).status).toBe(401);
    expect(state.writes).toHaveLength(0);
  });
  it("rejects unavailable or foreign CV IDs before provider requests", async () => {
    state.cvFound = false;
    expect((await search(request({ cvId, roleKeywords: "Director" }))).status).toBe(404);
    expect(state.provider).not.toHaveBeenCalled(); expect(state.writes).toHaveLength(0);
  });
  it("does not create a stuck search when provider config is absent", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    expect((await search(request({ cvId, roleKeywords: "Director" }))).status).toBe(503);
    expect(state.writes).toHaveLength(0);
  });
  it("records provider failure instead of leaving processing forever", async () => {
    state.provider.mockRejectedValue(new Error("upstream unavailable"));
    expect((await search(request({ cvId, roleKeywords: "Director" }))).status).toBe(502);
    expect(state.writes.at(-1)?.data).toMatchObject({ status: "failed" });
  });
  it("rejects another account's CV storage path", async () => {
    expect((await createCv(request({ name: "Foreign", filePath: `${cvId}/cv/file.pdf` }))).status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });
  it("retires automatic rejection without any database writes", async () => {
    expect((await overdue()).status).toBe(410); expect(state.writes).toHaveLength(0);
  });
});

describe("CV migration and match consistency", () => {
  it("ignores broken browser data and files owned by a different account", () => {
    expect(parseLegacyCvs("{bad", owner)).toEqual([]);
    expect(parseLegacyCvs(JSON.stringify([{ id: cvId, name: "Foreign", filePath: "another-user/file.pdf" }]), owner)).toEqual([]);
  });
  it("preserves legacy IDs and text for explicit import", () => {
    const result = parseLegacyCvs(JSON.stringify([{ id: cvId, name: "Director", summary: "Cloud", skills: "Leadership", filePath: `${owner}/cv-versions/x/file.pdf`, isDefault: true }]), owner);
    expect(result[0]).toMatchObject({ id: cvId, summary: "Cloud", isDefault: true });
  });
  it("maps saved account fields consistently for every selector", () => {
    expect(toCvVersion({ id: cvId, name: "Director", parsed_text: "Cloud", parsed_skills: ["Ops", "Leadership"], file_path: null, file_name: null, is_default: true, created_at: "2026-01-01" })).toMatchObject({ summary: "Cloud", skills: "Ops, Leadership", isDefault: true });
  });
  it("uses the same strong and medium thresholds as Postgres", () => {
    expect(computeJobMatch("alpha bravo charlie delta echo", "", { jobTitle: "alpha bravo charlie delta", jobDescription: "" })).toEqual({ score: 80, label: "Strong" });
    expect(computeJobMatch("alpha bravo charlie delta echo", "", { jobTitle: "alpha bravo charlie", jobDescription: "" })).toEqual({ score: 60, label: "Medium" });
    expect(computeJobMatch("", "", { jobTitle: "Director", jobDescription: "" })).toEqual({ score: 0, label: "Low" });
  });
});
