import type { Participant } from "@cloudcanvas/shared";
import { getAvatarInitials } from "@/lib/guest";

interface ParticipantsPanelProps {
  participants: Participant[];
  userId: string;
}


export function ParticipantsPanel({ participants, userId }: ParticipantsPanelProps) {
  return (
    <aside className="w-full rounded-3xl border border-fuchsia-100 bg-white p-4 shadow-sm transition xl:sticky xl:top-6 lg:w-[300px]" aria-label="Participants panel">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-purple-700">Party members</h3>

      {participants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-fuchsia-200 bg-fuchsia-50 px-4 py-6 text-center text-sm text-purple-500">Waiting for collaborators to join.</div>
      ) : (
        <ul className="space-y-2">
          {participants.map((participant) => {
            const isYou = participant.userId === userId;
            return (
              <li key={participant.socketId} className="flex items-center gap-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-3 py-2.5 transition-all hover:scale-[1.01] hover:bg-fuchsia-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-white text-xs font-semibold text-purple-700 shadow-sm">
                  {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.displayName} className="h-full w-full object-cover" /> : getAvatarInitials(participant.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-purple-800">{participant.displayName}</p>
                  <p className="text-xs text-purple-500">{isYou ? "You" : "Connected"}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
