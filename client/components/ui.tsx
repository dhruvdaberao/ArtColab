import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const baseButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        baseButton,
        "border-[color:var(--border)] bg-[color:var(--primary)] text-[color:var(--surface)] hover:bg-[color:var(--primary-strong)]",
        className,
      )}
      {...props}
    />
  );
});

export const SecondaryButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SecondaryButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        baseButton,
        "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft)]",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("comic-input", className)} {...props} />;
});

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 border-[color:var(--border)] bg-[color:var(--accent)]/80 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[color:var(--text-main)] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("comic-card", className)} {...props} />;
}
