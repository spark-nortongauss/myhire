import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("w-full rounded-lg border border-border bg-panel text-foreground px-3 py-2 text-sm transition focus-visible:border-primary", className)} {...props} />;
}
