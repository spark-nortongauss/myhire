"use client";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 pt-8 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={cn("modal-pop my-4 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl sm:my-8 sm:p-6")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold leading-tight">{title}</h2>
          <button className="shrink-0 rounded p-1 text-xl leading-none hover:bg-muted" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
