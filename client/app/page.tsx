"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { InfoCardsSection } from "@/components/info-cards";
import { FroddleLogo } from "@/components/froddle-logo";
import { SiteHeader } from "@/components/site-header";
import {
  Button,
  Card,
  Input,
  SecondaryButton,
  SuccessButton,
} from "@/components/ui";
import { createRoom, joinRoom } from "@/lib/api";
import {
  ensureGuestDisplayName,
  getStoredDisplayName,
  resolveSessionDisplayName,
  setStoredDisplayName,
} from "@/lib/guest";
import { grantRoomAccess } from "@/lib/room-access";
import { rememberRoomEntryHint } from "@/lib/room-entry";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, loginAsGuest } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [createName, setCreateName] = useState("");
  const [createVisibility, setCreateVisibility] = useState<
    "public" | "private"
  >("public");
  const [createPassword, setCreatePassword] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinVisibility, setJoinVisibility] = useState<"public" | "private">(
    "public",
  );
  const [joinPassword, setJoinPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isGuesting, setIsGuesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) setDisplayName(resolveSessionDisplayName(user));
  }, [user]);

  useEffect(() => {
    const deleted = searchParams.get("accountDeleted");
    if (deleted !== "1") return;

    const message = searchParams.get("message") || "Your account has been deleted.";
    setSuccessMessage(message);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("accountDeleted");
    params.delete("message");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/?${nextQuery}` : "/");
  }, [router, searchParams]);

  const persistDisplayName = (name: string) => {
    const normalized = name.trim();
    if (user?.role === "user") return user.username;
    return setStoredDisplayName(normalized);
  };

  const ensureDisplayName = () => {
    if (user?.role === "user") return user.username;
    const normalized =
      displayName.trim() || getStoredDisplayName() || ensureGuestDisplayName();
    setDisplayName(normalized);
    persistDisplayName(normalized);
    return normalized;
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const sessionName = ensureDisplayName();
    setIsCreating(true);
    setError(null);
    try {
      const data = await createRoom({
        name: createName.trim(),
        visibility: createVisibility,
        password: createVisibility === "private" ? createPassword : undefined,
        guestDisplayName: user?.role === "guest" ? sessionName : undefined,
      });
      if (data.room.visibility === "private") {
        grantRoomAccess(data.room.roomId);
      }
      rememberRoomEntryHint(data.room);
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message || "Unable to create room.");
    } finally {
      setIsCreating(false);
    }
  };

  const onJoin = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = ensureDisplayName();
    setDisplayName(normalized);
    setIsJoining(true);
    setError(null);
    try {
      const data = await joinRoom({
        name: joinName.trim(),
        visibility: joinVisibility,
        password: joinVisibility === "private" ? joinPassword : undefined,
        guestDisplayName: user?.role === "guest" ? normalized : undefined,
      });
      if (data.room.visibility === "private") {
        grantRoomAccess(data.room.roomId);
      }
      rememberRoomEntryHint(data.room);
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message || "Unable to join room.");
    } finally {
      setIsJoining(false);
    }
  };

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center text-lg font-semibold text-[color:var(--text-main)]">
        Loading Froddle…
      </main>
    );

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="grid flex-1 items-start gap-8 pt-1 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pt-2">
          <div className="space-y-6 self-center py-2 sm:space-y-7">
            <div className="flex justify-center lg:justify-start">
              <FroddleLogo
                priority
                imageClassName="max-w-[220px] sm:max-w-[300px]"
              />
            </div>
            <div className="space-y-3 text-center lg:text-left">
              <h1 className="text-3xl font-black text-[color:var(--text-main)] sm:text-5xl">
                Draw together. Giggle together. Stay in sync.
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-lg lg:mx-0">
                Froddle turns collaborative sketching into a playful room-based
                experience with live drawing, chat, reactions, and frog-powered
                personality.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
              <Link href="/browse-rooms">
                <SecondaryButton className="w-full sm:w-auto">
                  Browse rooms
                </SecondaryButton>
              </Link>
              <Link href="/manage-rooms">
                <Button className="w-full sm:w-auto">Manage rooms</Button>
              </Link>
            </div>
          </div>

          <Card className="space-y-4 bg-[color:var(--surface)] p-5 sm:p-6 lg:self-center">
            <p className="text-sm font-semibold text-[color:var(--text-muted)]">
              Hop in with an account or start a guest session.
            </p>
            <Link href="/auth?view=register" className="block">
              <SuccessButton className="w-full">Create account</SuccessButton>
            </Link>
            <Link href="/auth?view=login" className="block">
              <Button className="w-full">Login</Button>
            </Link>
            <SecondaryButton
              className="w-full"
              disabled={isGuesting}
              onClick={() => {
                setIsGuesting(true);
                setError(null);
                loginAsGuest()
                  .catch((e) => setError((e as Error).message))
                  .finally(() => setIsGuesting(false));
              }}
            >
              {isGuesting ? "Starting guest session…" : "Continue as guest"}
            </SecondaryButton>
            {error && <p className="status-banner status-danger">{error}</p>}
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <SiteHeader />

      {successMessage && <p className="mb-4 status-banner status-success">{successMessage}</p>}
      {error && <p className="mb-4 status-banner status-danger">{error}</p>}

      <section className="mb-6 space-y-4 px-1 py-1 text-center sm:mb-7 sm:space-y-5 lg:px-0">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
          <FroddleLogo
            priority
            imageClassName="max-w-[220px] sm:max-w-[320px]"
          />
          <div className="space-y-3">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[color:var(--brand-green)]">
              Welcome back, {resolveSessionDisplayName(user)}!
            </p>
            <h1 className="text-3xl font-black text-[color:var(--text-main)] sm:text-5xl">
              Your collaborative frog pond is ready.
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-lg">
              Create a fresh room, jump into an existing one, or explore active
              spaces without fighting the interface.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href="/browse-rooms">
              <SecondaryButton className="w-full sm:w-auto">
                Browse rooms
              </SecondaryButton>
            </Link>
            <Link href="/manage-rooms">
              <Button className="w-full sm:w-auto">Manage rooms</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 bg-[color:var(--surface)] p-5 sm:p-6">
          <h2 className="text-xl font-black text-[color:var(--text-main)]">
            Create room
          </h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Launch a fresh creative space for sketches, brainstorms, and shared
            experiments.
          </p>
          {user.role === "guest" && (
            <label className="block text-sm font-semibold text-[color:var(--text-main)]">
              Enter name (optional)
              <Input
                placeholder="Leave blank to use an auto-generated guest name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
                maxLength={32}
              />
            </label>
          )}
          <form className="space-y-3" onSubmit={onCreate}>
            <Input
              placeholder="Room name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
            />
            <select
              className="comic-select"
              value={createVisibility}
              onChange={(e) =>
                setCreateVisibility(e.target.value as "public" | "private")
              }
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {createVisibility === "private" && (
              <Input
                type="password"
                placeholder="Room password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            )}
            <SuccessButton
              type="submit"
              disabled={isCreating || isJoining}
              className="w-full"
            >
              {isCreating ? "Creating room…" : "Create room"}
            </SuccessButton>
          </form>
        </Card>
        <Card className="space-y-3 bg-[color:var(--surface)] p-5 sm:p-6">
          <h2 className="text-xl font-black text-[color:var(--text-main)]">
            Join room
          </h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Rejoin your crew with a room name and hop back into the shared
            board.
          </p>
          {user.role === "guest" && (
            <label className="block text-sm font-semibold text-[color:var(--text-main)]">
              Enter name (optional)
              <Input
                placeholder="Leave blank to use an auto-generated guest name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
                maxLength={32}
              />
            </label>
          )}
          <form className="space-y-3" onSubmit={onJoin}>
            <Input
              placeholder="Room name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
            />
            <select
              className="comic-select"
              value={joinVisibility}
              onChange={(e) =>
                setJoinVisibility(e.target.value as "public" | "private")
              }
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {joinVisibility === "private" && (
              <Input
                type="password"
                placeholder="Room password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
              />
            )}
            <Button
              type="submit"
              disabled={isCreating || isJoining}
              className="w-full"
              aria-busy={isJoining}
            >
              {isJoining ? "Joining…" : "Join room"}
            </Button>
            {isJoining ? (
              <p className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
                Joining your Froddle room and preparing the board…
              </p>
            ) : null}
          </form>
        </Card>
      </section>

      <section className="mt-6">
        <InfoCardsSection />
      </section>
    </main>
  );
}
