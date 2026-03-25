'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button, Input, SecondaryButton } from './ui';

export function RoomPasswordModal({ open, roomName, onCancel, onSubmit }: { open: boolean; roomName: string; onCancel: () => void; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color:var(--primary)]/28 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <div className="w-full max-w-sm rounded-[1.75rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] animate-[pop-in_0.2s_ease-out]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]/70 text-[color:var(--primary)]"><Lock className="h-4 w-4" /></span>
          <div>
            <h3 className="text-lg font-extrabold text-[color:var(--primary)]">This room is private</h3>
            <p className="mt-0.5 text-sm text-[color:var(--text-muted)]">{roomName}</p>
          </div>
        </div>
        <Input type="password" className="mt-4" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Room password" />
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <Button onClick={async () => { setLoading(true); try { await onSubmit(password); } finally { setLoading(false); } }} disabled={loading}>{loading ? 'Joining…' : 'Join room'}</Button>
        </div>
      </div>
    </div>
  );
}
