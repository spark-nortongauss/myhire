import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full rounded-lg border border-border bg-panel text-foreground px-3 py-2 text-sm transition placeholder:text-muted-foreground focus-visible:border-primary", className)} {...props} />;
}
