"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastTone = "success" | "error";

type ToastItem = { id: string; message: string; tone: ToastTone };
const ToastContext = createContext<{ pushToast: (message: string, tone?: ToastTone) => void }>({ pushToast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const pushToast = (message: string, tone: ToastTone = "success") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 2800);
  };
  const value = useMemo(() => ({ pushToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-80 flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className={`pointer-events-auto flex items-center justify-between rounded-xl border px-3 py-2 text-sm shadow-xl ${item.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            <span className="flex items-center gap-2">{item.tone === "success" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{item.message}</span>
            <button onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
