"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileUser, Sparkles, WandSparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";

type CvVersion = { id: string; name: string; summary: string; skills: string; isDefault?: boolean };
type JobOption = { id: string; job_title: string; company_name: string | null };

export default function CoverLetterGeneratorPage() {
  const supabase = useMemo(() => createClient(), []);
  const { pushToast } = useToast();
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [letter, setLetter] = useState("");
  const [displayLetter, setDisplayLetter] = useState("");
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

  useEffect(() => {
    if (!letter) return setDisplayLetter("");
    let idx = 0;
    const timer = setInterval(() => {
      idx += 12;
      setDisplayLetter(letter.slice(0, idx));
      if (idx >= letter.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [letter]);

  const generate = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    const cv = cvVersions.find((item) => item.id === selectedCvId);
    const response = await fetch("/api/cover-letter", { method: "POST", body: JSON.stringify({ jobId: selectedJobId, cvText: cv ? `${cv.summary}\n${cv.skills}` : "" }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return pushToast(payload.error || "Generation failed", "error");
    setLetter(payload.letter || "");
    pushToast("Cover letter generated");
  };

  const copyLetter = async () => {
    await navigator.clipboard.writeText(letter);
    pushToast("Copied to clipboard");
  };
  const download = () => {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Downloaded .txt");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-3xl font-black">Cover Letter Generator</h1>
      <p className="text-sm text-slate-600">Pick a job + CV profile, then generate a tailored letter with AI.</p>

      <div className="card grid gap-3 md:grid-cols-2">
        <div><p className="mb-1 flex items-center gap-2 text-sm font-medium"><FileUser size={14} />Job opportunity</p><Select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}><option value="">Select a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.job_title} {job.company_name ? `· ${job.company_name}` : ""}</option>)}</Select></div>
        <div><p className="mb-1 flex items-center gap-2 text-sm font-medium"><Sparkles size={14} />CV profile</p><Select value={selectedCvId} onChange={(event) => setSelectedCvId(event.target.value)}><option value="">Use no CV profile</option>{cvVersions.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.isDefault ? " (default)" : ""}</option>)}</Select></div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Generated Letter</h2><div className="flex gap-2"><Button variant="outline" onClick={copyLetter} disabled={!letter}><Copy size={14} />Copy</Button><Button variant="outline" onClick={download} disabled={!letter}><Download size={14} />Download .txt</Button><Button onClick={generate} disabled={!selectedJobId || loading}><WandSparkles size={14} />{loading ? "Generating..." : "Generate"}</Button></div></div>
        {loading ? <Skeleton className="h-80 w-full" /> : letter ? <Textarea className="min-h-80" value={displayLetter} onChange={(event) => setLetter(event.target.value)} placeholder="Your generated cover letter will appear here." /> : <EmptyState title="No cover letter yet" description="Generate a letter to start editing in this workspace." />}
      </div>
    </div>
  );
}
