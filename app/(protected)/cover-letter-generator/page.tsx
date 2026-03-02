"use client";

import { useEffect, useMemo, useState } from "react";
import { WandSparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CvVersion = { id: string; name: string; summary: string; skills: string; isDefault?: boolean };

type JobOption = { id: string; job_title: string; company_name: string | null };

export default function CoverLetterGeneratorPage() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("job_applications").select("id,job_title,company_name").order("applied_at", { ascending: false });
      setJobs(data ?? []);
      if (data?.length) setSelectedJobId(data[0].id);
    })();

    const stored = localStorage.getItem("myhire-cv-versions");
    const parsed = stored ? (JSON.parse(stored) as CvVersion[]) : [];
    setCvVersions(parsed);
    const defaultCv = parsed.find((item) => item.isDefault) ?? parsed[0];
    if (defaultCv) setSelectedCvId(defaultCv.id);
  }, [supabase]);

  const generate = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    const cv = cvVersions.find((item) => item.id === selectedCvId);
    const cvText = cv ? `${cv.summary}\n${cv.skills}` : "";

    const response = await fetch("/api/cover-letter", {
      method: "POST",
      body: JSON.stringify({ jobId: selectedJobId, cvText })
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return alert(payload.error || "Generation failed");
    setLetter(payload.letter || "");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Cover Letter Generator</h1>
      <p className="text-sm text-slate-600">Pick a saved opportunity and CV profile. AI will craft a tailored cover letter from your CV and the selected job description.</p>

      <div className="card grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">Job opportunity</p>
          <Select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
            <option value="">Select a job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_title} {job.company_name ? `· ${job.company_name}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">CV profile</p>
          <Select value={selectedCvId} onChange={(event) => setSelectedCvId(event.target.value)}>
            <option value="">Use no CV profile</option>
            {cvVersions.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.name}
                {cv.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generated Letter</h2>
          <Button onClick={generate} disabled={!selectedJobId || loading}>
            <WandSparkles size={14} className="mr-1" />
            {loading ? "Generating..." : "Generate"}
          </Button>
        </div>
        <Textarea className="min-h-80" value={letter} onChange={(event) => setLetter(event.target.value)} placeholder="Your generated cover letter will appear here." />
      </div>
    </div>
  );
}
