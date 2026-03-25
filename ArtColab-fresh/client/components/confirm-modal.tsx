import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, SecondaryButton } from "./ui";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, destructive = false }: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    cancelButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color:var(--primary)]/28 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-[1.75rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] animate-[pop-in_0.2s_ease-out]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border)] ${destructive ? 'bg-[color:var(--danger-soft)] text-[color:var(--danger)]' : 'bg-[color:var(--accent)]/70 text-[color:var(--primary)]'}`}>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 id="confirm-title" className="text-lg font-extrabold text-[color:var(--primary)]">{title}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SecondaryButton ref={cancelButtonRef} onClick={onCancel}>{cancelLabel}</SecondaryButton>
          <Button onClick={onConfirm} className={destructive ? "bg-[color:var(--brand-red)] text-[color:var(--surface)] hover:bg-[color:var(--brand-red)]" : ""}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
