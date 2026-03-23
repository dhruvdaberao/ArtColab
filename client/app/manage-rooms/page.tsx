"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { InfoCardsSection } from "@/components/info-cards";
import { SiteHeader } from "@/components/site-header";
import {
  Badge,
  Button,
  Card,
  DangerButton,
  Input,
  SecondaryButton,
} from "@/components/ui";
import {
  deleteRoom,
  getManageRooms,
  leaveRoom,
  updateRoomSettings,
  type RoomListItem,
} from "@/lib/api";

type RoomVisibility = "public" | "private";

const initialFormState = {
  name: "",
  visibility: "public" as RoomVisibility,
  password: "",
};

export default function ManageRoomsPage() {
  const router = useRouter();
  const editCardRef = useRef<HTMLDivElement | null>(null);
  const [ownedRooms, setOwnedRooms] = useState<RoomListItem[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoomListItem | null>(null);
  const [form, setForm] = useState(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);

  const resetEditor = () => {
    setEditing(null);
    setForm(initialFormState);
    setIsSaving(false);
  };

  const load = async () => {
    const data = await getManageRooms();
    setOwnedRooms(data.ownedRooms);
    setJoinedRooms(data.joinedRooms);
  };

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!editing) return;
    editCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing]);

  const startEditing = (room: RoomListItem) => {
    setError(null);
    setSuccessMessage(null);
    setEditing(room);
    setForm({
      name: room.name,
      visibility: room.visibility,
      password: "",
    });
  };

  const cancelEditing = () => {
    setError(null);
    setSuccessMessage(null);
    resetEditor();
  };

  const isFormValid = useMemo(() => {
    const trimmedName = form.name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 48) return false;
    if (!/^[A-Za-z0-9 _-]+$/.test(trimmedName)) return false;
    if (
      form.visibility === "private" &&
      form.password.trim().length > 0 &&
      form.password.trim().length < 4
    )
      return false;
    return true;
  }, [form]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !isFormValid) return;

    const trimmedName = form.name.trim();
    const trimmedPassword = form.password.trim();
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await updateRoomSettings(editing.roomId, {
        name: trimmedName,
        visibility: form.visibility,
        password:
          form.visibility === "private"
            ? trimmedPassword || undefined
            : undefined,
      });

      await load();
      setSuccessMessage(
        `Updated room ${response.room.name} (${response.room.roomId}).`,
      );
      resetEditor();
    } catch (saveError) {
      setError(
        (saveError as Error).message || "Failed to update room settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const runRoomAction = async (
    roomId: string,
    action: () => Promise<unknown>,
    message: string,
  ) => {
    setBusyRoomId(roomId);
    setError(null);
    setSuccessMessage(null);

    try {
      await action();
      if (editing?.roomId === roomId) resetEditor();
      await load();
      setSuccessMessage(message);
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setBusyRoomId(null);
    }
  };

  const roomRow = (room: RoomListItem, owned: boolean) => (
    <div
      key={room.roomId}
      className="flex flex-col gap-3 rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-black text-[color:var(--primary)]">
            {room.name}
          </p>
          {editing?.roomId === room.roomId ? (
            <Badge className="bg-[color:var(--surface-soft)] text-[color:var(--text-main)]">
              Editing now
            </Badge>
          ) : null}
        </div>
        <p className="break-all text-xs text-[color:var(--text-muted)]">
          🔑 {room.roomId} · 👥 {room.participants} active
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="capitalize">{room.visibility}</Badge>
        <Button
          type="button"
          onClick={() => router.push(`/room/${room.roomId}`)}
        >
          Open
        </Button>
        {owned ? (
          <>
            <SecondaryButton
              type="button"
              onClick={() => startEditing(room)}
              aria-pressed={editing?.roomId === room.roomId}
            >
              {editing?.roomId === room.roomId ? "Editing" : "Edit"}
            </SecondaryButton>
            <DangerButton
              type="button"
              disabled={busyRoomId === room.roomId}
              onClick={() =>
                runRoomAction(
                  room.roomId,
                  () => deleteRoom(room.roomId),
                  `Deleted room ${room.name}.`,
                )
              }
            >
              {busyRoomId === room.roomId ? "Deleting…" : "Delete"}
            </DangerButton>
          </>
        ) : (
          <SecondaryButton
            type="button"
            disabled={busyRoomId === room.roomId}
            onClick={() =>
              runRoomAction(
                room.roomId,
                () => leaveRoom(room.roomId),
                `Left room ${room.name}.`,
              )
            }
          >
            {busyRoomId === room.roomId ? "Leaving…" : "Leave"}
          </SecondaryButton>
        )}
      </div>
    </div>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <SiteHeader compact />
      <Link href="/">
        <SecondaryButton type="button">Back home</SecondaryButton>
      </Link>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h1 className="text-2xl font-black text-[color:var(--text-main)]">
          Manage your Froddle rooms
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-muted)]">
          Edit room details, clean up old spaces, or hop back into active rooms
          without disrupting the rest of the room workflow.
        </p>
      </Card>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--text-main)]">
          Owned rooms
        </h2>
        {ownedRooms.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            No owned rooms yet.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {ownedRooms.map((room) => roomRow(room, true))}
        </div>
      </Card>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--text-main)]">
          Joined rooms
        </h2>
        {joinedRooms.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            No joined rooms yet.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {joinedRooms.map((room) => roomRow(room, false))}
        </div>
      </Card>
      {editing ? (
        <div ref={editCardRef}>
          <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-black text-[color:var(--text-main)]">
                  Edit room
                </h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  You are editing{" "}
                  <span className="font-semibold text-[color:var(--text-main)]">
                    {editing.name}
                  </span>{" "}
                  ({editing.roomId}).
                </p>
              </div>
              <Badge className="w-fit capitalize">{form.visibility}</Badge>
            </div>
            <form onSubmit={save} className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-[color:var(--text-main)]">
                Room name
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-2"
                  maxLength={48}
                />
              </label>
              <label className="block text-sm font-semibold text-[color:var(--text-main)]">
                Visibility
                <select
                  className="comic-select mt-2"
                  value={form.visibility}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      visibility: e.target.value as RoomVisibility,
                      password:
                        e.target.value === "private" ? current.password : "",
                    }))
                  }
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
              {form.visibility === "private" ? (
                <label className="block text-sm font-semibold text-[color:var(--text-main)]">
                  {editing.visibility === "private"
                    ? "Replace room password"
                    : "Room password"}
                  <Input
                    type="password"
                    placeholder={
                      editing.visibility === "private"
                        ? "Leave blank to keep current password"
                        : "Enter a password with at least 4 characters"
                    }
                    value={form.password}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        password: e.target.value,
                      }))
                    }
                    className="mt-2"
                  />
                  <span className="mt-2 block text-xs font-medium text-[color:var(--text-muted)]">
                    {editing.visibility === "private"
                      ? "Leave this empty to keep the existing password, or enter a new one to replace it."
                      : "Private rooms require a password before other users can join."}
                  </span>
                </label>
              ) : (
                <p className="rounded-[1.25rem] border border-dashed border-[color:var(--border)]/40 bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                  Public rooms do not store a password. Switching to public
                  clears the room password on save.
                </p>
              )}
              {!isFormValid ? (
                <p className="status-banner status-danger">
                  Use a 3–48 character room name with letters, numbers, spaces,
                  hyphens, or underscores. Private passwords must be at least 4
                  characters when provided.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isSaving || !isFormValid}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
                <SecondaryButton type="button" onClick={cancelEditing}>
                  Cancel
                </SecondaryButton>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
      <section className="pt-2">
        <InfoCardsSection />
      </section>
      {successMessage ? (
        <p className="status-banner status-success">{successMessage}</p>
      ) : null}
      {error ? <p className="status-banner status-danger">{error}</p> : null}
    </main>
  );
}
