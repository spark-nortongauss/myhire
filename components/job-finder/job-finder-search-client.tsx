"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { JOB_FINDER_EMPLOYMENT_TYPES, JOB_FINDER_REQUIREMENTS } from "@/lib/job-finder/types";

type CvVersion = { id: string; name: string; summary: string; skills: string; isDefault?: boolean };

const localeDefaults: Record<string, { country: string; language: string }> = {
  "en-US": { country: "US", language: "EN" },
  "zh-CN": { country: "CN", language: "ZH" },
  "es-ES": { country: "ES", language: "ES" },
  "fr-FR": { country: "FR", language: "FR" },
  ar: { country: "SA", language: "AR" },
  "pt-BR": { country: "BR", language: "PT" },
  "hi-IN": { country: "IN", language: "HI" }
};

export function JobFinderSearchClient() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(false);
  const cvVersions: CvVersion[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("myhire-cv-versions");
    return stored ? (JSON.parse(stored) as CvVersion[]) : [];
  }, []);

  const locale = typeof window !== "undefined" ? localStorage.getItem("myhire-locale") ?? "en-US" : "en-US";
  const defaults = localeDefaults[locale] ?? localeDefaults["en-US"];

  const [cvId, setCvId] = useState(() => cvVersions.find((cv) => cv.isDefault)?.id ?? cvVersions[0]?.id ?? "");
  const [roleKeywords, setRoleKeywords] = useState("");
  const [country, setCountry] = useState(defaults.country);
  const [language, setLanguage] = useState(defaults.language);
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [datePosted, setDatePosted] = useState("all");
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [jobRequirements, setJobRequirements] = useState<string[]>([]);
  const [radius, setRadius] = useState("25");
  const [excludeJobPublishers, setExcludeJobPublishers] = useState("");
  const [page, setPage] = useState("1");
  const [numPages, setNumPages] = useState("1");

  const reset = () => {
    setRoleKeywords("");
    setCountry(defaults.country);
    setLanguage(defaults.language);
    setLocation("");
    setRemoteOnly(false);
    setDatePosted("all");
    setEmploymentTypes([]);
    setJobRequirements([]);
    setRadius("25");
    setExcludeJobPublishers("");
    setPage("1");
    setNumPages("1");
  };

  const toggleMulti = (current: string[], value: string, set: (next: string[]) => void) => {
    set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const submit = async () => {
    if (!cvId) return pushToast("Select a CV first.", "error");
    if (!roleKeywords.trim()) return pushToast("Role / keywords are required.", "error");

    const cv = cvVersions.find((item) => item.id === cvId);
    setLoading(true);
    const response = await fetch("/api/job-finder/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cvId,
        cvName: cv?.name,
        cvSummary: cv?.summary,
        cvSkills: cv?.skills,
        roleKeywords,
        country,
        language,
        location,
        remoteOnly,
        datePosted,
        employmentTypes,
        jobRequirements,
        radius: Number(radius || 0),
        excludeJobPublishers,
        page: Number(page || 1),
        numPages: Number(numPages || 1)
      })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) return pushToast(payload.error || "Search failed", "error");
    router.push(`/job-finder/results/${payload.searchId}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="card">
        <h1 className="flex items-center gap-2 text-3xl font-black"><Search size={24} />Job Finder</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your CV profile + filters to find matching openings.</p>
      </div>

      <div className="card grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">CV selector *</p>
          <Select value={cvId} onChange={(e) => setCvId(e.target.value)}>
            <option value="">Select CV</option>
            {cvVersions.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.isDefault ? " (default)" : ""}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Role / keywords *</p>
          <Input value={roleKeywords} onChange={(e) => setRoleKeywords(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
        </div>
        <div><p className="mb-1 text-sm font-medium">Country code</p><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} /></div>
        <div><p className="mb-1 text-sm font-medium">Language</p><Input value={language} onChange={(e) => setLanguage(e.target.value.toUpperCase())} maxLength={5} /></div>
        <div><p className="mb-1 text-sm font-medium">Location</p><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or region" /></div>
        <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />Remote only</label>
        <div><p className="mb-1 text-sm font-medium">Date posted</p><Select value={datePosted} onChange={(e) => setDatePosted(e.target.value)}><option value="all">All</option><option value="today">Today</option><option value="3days">Last 3 days</option><option value="week">Last week</option><option value="month">Last month</option></Select></div>
        <div><p className="mb-1 text-sm font-medium">Radius</p><Input type="number" min={0} max={500} value={radius} onChange={(e) => setRadius(e.target.value)} /></div>
        <div><p className="mb-1 text-sm font-medium">Exclude publishers</p><Input value={excludeJobPublishers} onChange={(e) => setExcludeJobPublishers(e.target.value)} placeholder="linkedin, indeed" /></div>
        <div><p className="mb-1 text-sm font-medium">Page</p><Input type="number" min={1} max={20} value={page} onChange={(e) => setPage(e.target.value)} /></div>
        <div><p className="mb-1 text-sm font-medium">Num pages (max 5)</p><Input type="number" min={1} max={5} value={numPages} onChange={(e) => setNumPages(e.target.value)} /></div>
      </div>

      <div className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Filter size={16} />Filter sets</h2>
        <div>
          <p className="mb-2 text-sm font-medium">Employment types</p>
          <div className="flex flex-wrap gap-2">
            {JOB_FINDER_EMPLOYMENT_TYPES.map((value) => <button key={value} type="button" onClick={() => toggleMulti(employmentTypes, value, setEmploymentTypes)} className={`rounded-full border px-3 py-1 text-xs ${employmentTypes.includes(value) ? "bg-indigo-600 text-white" : "bg-white"}`}>{value}</button>)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Job requirements</p>
          <div className="flex flex-wrap gap-2">
            {JOB_FINDER_REQUIREMENTS.map((value) => <button key={value} type="button" onClick={() => toggleMulti(jobRequirements, value, setJobRequirements)} className={`rounded-full border px-3 py-1 text-xs ${jobRequirements.includes(value) ? "bg-indigo-600 text-white" : "bg-white"}`}>{value}</button>)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={loading}><Sparkles size={14} />{loading ? "Searching..." : "Search"}</Button>
        <Button variant="outline" onClick={reset}>Clear/reset</Button>
      </div>
    </div>
  );
}
