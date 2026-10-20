import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeNext } from "@/lib/auth-navigation";
import { zonedInstant, wallTime } from "@/lib/workspace/time";
import { schemas } from "@/lib/workspace/validation";
import { nextInterview, safeWebUrl } from "@/lib/workspace/types";
const state = vi.hoisted(() => ({
  authenticated: true,
  authError: false,
  writes: [] as any[],
  filters: [] as any[],
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: state.authenticated
            ? { id: "11111111-1111-4111-8111-111111111111" }
            : null,
        },
      }),
      exchangeCodeForSession: async () => ({
        error: state.authError ? { message: "expired" } : null,
      }),
      verifyOtp: async () => ({
        error: state.authError ? { message: "expired" } : null,
      }),
    },
    from: (table: string) => {
      const q: any = {
        insert: (data: any) => {
          state.writes.push({ table, data });
          return q;
        },
        update: (data: any) => {
          state.writes.push({ table, data });
          return q;
        },
        delete: () => q,
        eq: (key: string, value: any) => {
          state.filters.push({ key, value });
          return q;
        },
        select: () => q,
        maybeSingle: async () => ({
          data: { id: "22222222-2222-4222-8222-222222222222" },
          error: null,
        }),
      };
      return q;
    },
  }),
}));
import { POST, PATCH } from "@/app/api/workspace/route";
import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";
const request = (data: unknown) =>
  new Request("https://myhire-delta.vercel.app/api/workspace", {
    method: "POST",
    body: JSON.stringify(data),
  });
const story = {
  title: "Incident response",
  situation: "Context",
  task: "Restore",
  action: "Coordinated",
  result: "Recovered",
  short_version: "",
  skills: [],
  principles: [],
  language: "en",
  status: "ready",
};
beforeEach(() => {
  state.authenticated = true;
  state.authError = false;
  state.writes = [];
  state.filters = [];
});
describe("workspace isolation and validation", () => {
  it("rejects anonymous writes", async () => {
    state.authenticated = false;
    expect(
      (await POST(request({ resource: "stories", data: story }))).status,
    ).toBe(401);
    expect(state.writes).toHaveLength(0);
  });
  it("derives owner from authenticated identity and refuses injected owner", async () => {
    expect(
      (
        await POST(
          request({
            resource: "stories",
            data: { ...story, user_id: "foreign" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(state.writes).toHaveLength(0);
    expect(
      (await POST(request({ resource: "stories", data: story }))).status,
    ).toBe(200);
    expect(state.writes[0].data.user_id).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
  it("requires complete STAR before ready and bounds input", async () => {
    expect(
      (
        await POST(
          request({ resource: "stories", data: { ...story, result: "" } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({
            resource: "stories",
            data: { ...story, title: "x".repeat(251) },
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("scopes updates by both record id and owner", async () => {
    expect(
      (
        await PATCH(
          request({
            resource: "stories",
            id: "22222222-2222-4222-8222-222222222222",
            data: story,
          }),
        )
      ).status,
    ).toBe(200);
    expect(state.filters).toEqual([
      { key: "id", value: "22222222-2222-4222-8222-222222222222" },
      { key: "user_id", value: "11111111-1111-4111-8111-111111111111" },
    ]);
  });
  it("rejects script links, invalid zones and invalid dates", () => {
    const i = {
      job_application_id: "22222222-2222-4222-8222-222222222222",
      interviewer: "Test",
      starts_at: "2026-10-23T09:00:00+02:00",
      duration_minutes: 60,
      time_zone: "Europe/Paris",
      meeting_url: "",
      notes: "",
      status: "scheduled",
    };
    expect(schemas.interviews.safeParse(i).success).toBe(true);
    expect(
      schemas.interviews.safeParse({ ...i, meeting_url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      schemas.interviews.safeParse({ ...i, time_zone: "nope" }).success,
    ).toBe(false);
    expect(safeWebUrl("javascript:alert(1)")).toBeNull();
  });
});
describe("login and interview scheduling", () => {
  it("handles expiry and no code without a success redirect", async () => {
    state.authError = true;
    const r = await GET(
      new NextRequest(
        "https://myhire-delta.vercel.app/auth/callback?code=expired",
      ),
    );
    expect(r.headers.get("location")).toBe(
      "https://myhire-delta.vercel.app/login?error=link",
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it("returns to an allowed deep link after successful exchange", async () => {
    const r = await GET(
      new NextRequest(
        "https://myhire-delta.vercel.app/auth/callback?code=valid&next=%2Fjobs%2F123%3Ftab%3Dpreparation",
      ),
    );
    expect(r.headers.get("location")).toBe(
      "https://myhire-delta.vercel.app/jobs/123?tab=preparation",
    );
  });
  it("blocks external and deceptive redirects", () => {
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/jobs\\@evil.test",
      "/dashboardevil",
    ])
      expect(safeNext(value)).toBe("/dashboard");
  });
  it("preserves Paris wall clock across the October DST change", () => {
    expect(zonedInstant("2026-10-23T09:00", "Europe/Paris")).toBe(
      "2026-10-23T07:00:00.000Z",
    );
    expect(zonedInstant("2026-10-27T11:00", "Europe/Paris")).toBe(
      "2026-10-27T10:00:00.000Z",
    );
    expect(wallTime("2026-10-27T10:00:00Z", "Europe/Paris")).toBe(
      "2026-10-27T11:00",
    );
    expect(() => zonedInstant("2026-10-25T02:30", "Europe/Paris")).toThrow();
    expect(() => zonedInstant("2026-03-29T02:30", "Europe/Paris")).toThrow();
  });
  it("ignores cancelled and past interviews", () => {
    const items = [
      {
        id: "1",
        job_application_id: "j",
        starts_at: "2026-10-21T07:00:00Z",
        status: "cancelled",
      },
      {
        id: "2",
        job_application_id: "j",
        starts_at: "2026-10-19T07:00:00Z",
        status: "scheduled",
      },
      {
        id: "3",
        job_application_id: "j",
        starts_at: "2026-10-23T07:00:00Z",
        status: "scheduled",
      },
    ];
    expect(
      nextInterview(items as any, "j", Date.parse("2026-10-20T07:00:00Z"))?.id,
    ).toBe("3");
  });
});
