import type { Participant } from "@cloudcanvas/shared";

interface ParticipantsPanelProps {
  participants: Participant[];
  userId: string;
}

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "G";

export function ParticipantsPanel({
  participants,
  userId,
}: ParticipantsPanelProps) {
  return (
    <aside
      className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition xl:sticky xl:top-6 lg:w-[300px]"
      aria-label="Participants panel"
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Participants
      </h3>

      {participants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Waiting for collaborators to join.
        </div>
      ) : (
        <ul className="space-y-2">
          {participants.map((participant) => {
            const isYou = participant.userId === userId;
            return (
              <li
                key={participant.socketId}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 transition-colors hover:bg-slate-100/80"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 shadow-sm">
                  {initialsFor(participant.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {participant.displayName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isYou ? "You" : "Connected"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
