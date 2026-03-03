"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Globe, Save, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";

const localeOptions = ["en-US", "zh-CN", "es-ES", "fr-FR", "ar", "pt-BR", "hi-IN"];

export default function SettingsPage() {
  const supabase = createClient();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ full_name: "", locale: "en-US" });
  const [errors, setErrors] = useState<{ full_name?: string }>({});

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userData.user.id).maybeSingle();
      setForm((prev) => ({ ...prev, ...data }));
    })();
  }, [supabase]);

  const save = async () => {
    if (form.full_name.trim().length < 2) return setErrors({ full_name: "Please enter at least 2 characters." });
    setErrors({});
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const payload = { full_name: form.full_name, locale: form.locale, user_id: userData.user.id };
    const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
    pushToast(error?.message || "Settings saved", error ? "error" : "success");
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-black">Settings</h1>
      <div className="card space-y-3">
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm"><User size={14} />Full Name</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          {errors.full_name ? <p className="mt-1 text-xs text-rose-600">{errors.full_name}</p> : null}
        </div>
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm"><Globe size={14} />Locale</label>
          <Select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>{localeOptions.map((locale) => <option key={locale}>{locale}</option>)}</Select>
        </div>
        <Button onClick={save}><Save size={14} />Save settings</Button>
      </div>

      <div className="card space-y-2 border-indigo-100">
        <p className="text-sm font-semibold text-indigo-700">Chrome Extension</p>
        <p className="text-sm text-slate-600">Install the MyHire extension to capture opportunities directly from job boards.</p>
        <Link href="/api/chrome-plugin-download" download className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-200/60 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 sm:w-auto"><Download size={14} className="mr-2" />Download Chrome Extension</Link>
      </div>
    </div>
  );
}
