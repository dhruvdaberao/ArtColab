import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const baseButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.2rem] border-2 px-4 py-2.5 text-sm font-black tracking-[0.01em] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[2px] active:shadow-none";

const flatButtonBase =
  "border-[color:var(--border)] shadow-[0_6px_0_rgba(26,26,26,0.18)] hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-[0_8px_0_rgba(26,26,26,0.16)] active:translate-y-[2px]";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        baseButton,
        flatButtonBase,
        "bg-[color:var(--brand-blue)] text-[color:var(--surface)]",
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
        flatButtonBase,
        "bg-[color:var(--brand-yellow)] text-[color:var(--text-main)]",
        className,
      )}
      {...props}
    />
  );
});

export const DangerButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function DangerButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        baseButton,
        flatButtonBase,
        "bg-[color:var(--brand-red)] text-white",
        className,
      )}
      {...props}
    />
  );
});

export const SuccessButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SuccessButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        baseButton,
        flatButtonBase,
        "bg-[color:var(--brand-green)] text-white",
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
        "inline-flex items-center rounded-full border-2 border-[color:var(--border)] bg-[color:var(--accent)]/85 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[color:var(--text-main)] uppercase",
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
