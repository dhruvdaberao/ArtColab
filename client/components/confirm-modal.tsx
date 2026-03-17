import { useEffect, useRef } from "react";
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-purple-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-fuchsia-100 bg-white p-5 shadow-xl animate-[pop-in_0.2s_ease-out]" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-extrabold text-purple-900">{title}</h2>
        <p className="mt-2 text-sm text-purple-600">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton ref={cancelButtonRef} onClick={onCancel}>{cancelLabel}</SecondaryButton>
          <Button onClick={onConfirm} className={destructive ? "bg-rose-500 hover:bg-rose-400 focus-visible:ring-rose-300" : ""}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
