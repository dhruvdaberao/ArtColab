import type { Participant } from "@cloudcanvas/shared";
import { Users } from "lucide-react";
import { getAvatarInitials } from "@/lib/guest";

interface ParticipantsPanelProps {
  participants: Participant[];
  userId: string;
}

export function ParticipantsPanel({ participants, userId }: ParticipantsPanelProps) {
  return (
    <aside className="w-full rounded-[1.75rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)] transition xl:sticky xl:top-6 lg:w-[300px]" aria-label="Participants panel">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]/70 text-[color:var(--primary)]">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Participants</h3>
          <p className="text-xs text-[color:var(--text-muted)]">Live collaborators in this room</p>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-[color:var(--primary)]/20 bg-[color:var(--surface-soft)] px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">
          Waiting for collaborators to join.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {participants.map((participant) => {
            const isYou = participant.userId === userId;
            return (
              <li key={participant.socketId} className="flex items-center gap-3 rounded-[1.25rem] border border-[color:var(--primary)]/12 bg-[color:var(--bg-elevated)] px-3 py-3 transition-all hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-semibold text-[color:var(--primary)] shadow-sm">
                  {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.displayName} className="h-full w-full object-cover" /> : getAvatarInitials(participant.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[color:var(--text-main)]">{participant.displayName}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{isYou ? "You" : "Connected"}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--primary)] animate-pulse" aria-hidden />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
