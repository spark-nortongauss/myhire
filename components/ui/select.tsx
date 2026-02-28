import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("w-full rounded-md border border-border bg-white px-3 py-2 text-sm", className)} {...props} />;
}
