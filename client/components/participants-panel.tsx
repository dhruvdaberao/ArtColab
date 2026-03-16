import type { Participant } from '@cloudcanvas/shared';

export function ParticipantsPanel({ participants }: { participants: Participant[] }) {
  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-64">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Participants ({participants.length})</h3>
      <ul className="space-y-2">
        {participants.map((participant) => (
          <li key={participant.socketId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {participant.displayName}
          </li>
        ))}
      </ul>
    </aside>
  );
}
