import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm shadow-sm transition focus-visible:border-indigo-300", className)} {...props} />;
}
