'use client';

import { useState } from 'react';
import { Button, Input, SecondaryButton } from './ui';

export function RoomPasswordModal({ open, roomName, onCancel, onSubmit }: { open: boolean; roomName: string; onCancel: () => void; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-purple-900/40 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <div className="w-full max-w-sm rounded-3xl border border-fuchsia-100 bg-white p-5 shadow-xl animate-[pop-in_0.2s_ease-out]" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-purple-900">Sweet, this room is private 🔐</h3>
        <p className="mt-1 text-sm text-purple-600">{roomName}</p>
        <Input type="password" className="mt-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Room password" />
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <Button onClick={async () => { setLoading(true); try { await onSubmit(password); } finally { setLoading(false); } }} disabled={loading}>{loading ? 'Joining…' : 'Join room'}</Button>
        </div>
      </div>
    </div>
  );
}
