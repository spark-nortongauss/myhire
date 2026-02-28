"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AnimatedBackground } from "@/components/login/animated-bg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(error.message);
    router.push("/dashboard");
    router.refresh();
  };

  const sendMagicLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    setMessage(error ? error.message : "Magic link sent! Please check your inbox.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 text-white">
      <AnimatedBackground reducedMotion={reduceMotion} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-black/50 p-6 backdrop-blur">
        <h1 className="text-2xl font-bold">Welcome to MyHire</h1>
        <p className="mt-2 text-sm text-white/80">Track and optimize your job search from one dashboard.</p>

        <label className="mt-4 block text-sm">Email</label>
        <Input className="mt-1 bg-white text-black" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="mt-4 block text-sm">Password</label>
        <Input
          type="password"
          className="mt-1 bg-white text-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={signIn}>Sign in</Button>
          <Button variant="outline" className="text-black" onClick={sendMagicLink}>
            Send magic link
          </Button>
          <label className="text-xs text-white/80">
            <input type="checkbox" className="mr-2" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
            Reduce motion
          </label>
        </div>
        {message ? <p className="mt-3 text-sm text-amber-300">{message}</p> : null}
      </div>
    </main>
  );
}
