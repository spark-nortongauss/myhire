import { cn } from "@/lib/utils";

type Option = { label: string; value: string };

export function SegmentedControl({ value, options, onChange }: { value: string; options: Option[]; onChange: (next: string) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border/70 bg-panel/80 p-1 shadow-sm">
      {options.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
            value === item.value ? "bg-indigo-600 text-white shadow" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
