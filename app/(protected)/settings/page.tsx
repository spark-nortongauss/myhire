"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function SettingsPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ full_name: "", locale: "en-US", default_platform: "", default_work_mode: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userData.user.id).maybeSingle();
      if (data) setForm({ ...form, ...data });
    })();
  }, []);

  const save = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const payload = { ...form, user_id: userData.user.id };
    const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
    setMessage(error ? error.message : "Settings saved");
  };

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="card space-y-3">
        <div>
          <label className="text-sm">Full Name</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm">Locale</label>
          <Input value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} />
        </div>
        <div>
          <label className="text-sm">Default Platform</label>
          <Select value={form.default_platform} onChange={(e) => setForm({ ...form, default_platform: e.target.value })}>
            <option value="">None</option>
            <option>linkedin</option>
            <option>indeed</option>
            <option>wellfound</option>
            <option>company_site</option>
            <option>other</option>
          </Select>
        </div>
        <div>
          <label className="text-sm">Default Work Mode</label>
          <Select value={form.default_work_mode} onChange={(e) => setForm({ ...form, default_work_mode: e.target.value })}>
            <option value="">None</option>
            <option>remote</option>
            <option>hybrid</option>
            <option>on_site</option>
          </Select>
        </div>
        <Button onClick={save}>Save settings</Button>
        {message ? <p className="text-sm">{message}</p> : null}
      </div>
    </div>
  );
}
