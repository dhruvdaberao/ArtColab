export interface ToastMessage {
  id: string;
  message: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
}

export function ToastStack({ toasts }: ToastStackProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-xs flex-col gap-2 sm:max-w-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-lg backdrop-blur transition-all duration-200"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
