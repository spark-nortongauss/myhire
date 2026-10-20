import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("w-full rounded-lg border border-border bg-panel text-foreground px-3 py-2 text-sm", className)} {...props} />;
}
