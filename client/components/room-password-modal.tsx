'use client';

import { useState } from 'react';
import { Button, Input, SecondaryButton } from './ui';

export function RoomPasswordModal({ open, roomName, onCancel, onSubmit }: { open: boolean; roomName: string; onCancel: () => void; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onMouseDown={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Enter password</h3>
        <p className="mt-1 text-sm text-slate-600">{roomName}</p>
        <Input type="password" className="mt-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Room password" />
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <Button onClick={async () => { setLoading(true); try { await onSubmit(password); } finally { setLoading(false); } }} disabled={loading}>{loading ? 'Joining…' : 'Join'}</Button>
        </div>
      </div>
    </div>
  );
}
