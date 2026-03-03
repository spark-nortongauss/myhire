import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm shadow-sm transition placeholder:text-slate-400 focus-visible:border-indigo-300", className)} {...props} />;
}
