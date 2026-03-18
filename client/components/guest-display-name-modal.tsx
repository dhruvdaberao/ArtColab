'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, SecondaryButton } from '@/components/ui';

export function GuestDisplayNameModal({
  open,
  initialValue,
  title = 'Choose a display name',
  description = 'Enter the name you want to use in this Art Colab session before joining or creating a room.',
  confirmLabel = 'Continue',
  onCancel,
  onConfirm
}: {
  open: boolean;
  initialValue?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialValue ?? '');
      setError(null);
      setSubmitting(false);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError('Please enter a display name before joining or creating a room.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(normalized);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 px-4 py-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-[2rem] border-2 border-black bg-[#fffdf7] p-6 shadow-[8px_8px_0_rgba(17,24,39,0.08)]">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Your name" />
        {error && <p className="rounded-2xl border-2 border-black bg-[#fbe4e0] px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <SecondaryButton type="button" onClick={onCancel} className="w-full sm:w-auto">Cancel</SecondaryButton>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">{submitting ? 'Saving…' : confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}
