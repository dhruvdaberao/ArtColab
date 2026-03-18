'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui';
import { AuthCard, type AuthView } from '@/components/auth-card';
import { FroddleWordmark } from '@/components/froddle-logo';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const initialView: AuthView = requestedView === 'register' || requestedView === 'forgot-request' || requestedView === 'forgot-verify' ? requestedView : 'login';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="brand-panel space-y-5 rounded-[2rem] border-2 border-[color:var(--border)] p-6 shadow-[var(--shadow)] sm:p-8 lg:p-10">
          <Badge className="bg-[color:var(--brand-yellow)]">Frog-powered creative rooms</Badge>
          <FroddleWordmark />
          <div className="space-y-3 text-sm text-[color:var(--text-muted)] sm:text-base">
            <p className="max-w-xl">Froddle keeps drawing with friends delightfully fast: jump in as a guest, sign in to keep your profile, and hop between shared rooms without friction.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border-2 border-[color:var(--border)] bg-white/75 p-4">
                <p className="font-bold text-[color:var(--text-main)]">Sketch live</p>
                <p className="mt-1 text-sm">Realtime strokes, chat, reactions, and synced cursors.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-[color:var(--border)] bg-white/75 p-4">
                <p className="font-bold text-[color:var(--text-main)]">Keep it playful</p>
                <p className="mt-1 text-sm">Bold, friendly tools with a polished frog-inspired theme.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-[color:var(--border)] bg-white/75 p-4">
                <p className="font-bold text-[color:var(--text-main)]">Stay flexible</p>
                <p className="mt-1 text-sm">Use guest mode instantly or save your identity with an account.</p>
              </div>
            </div>
          </div>
        </section>
        <AuthCard initialView={initialView} />
      </div>
    </main>
  );
}

export default function AuthPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}><AuthPageContent /></Suspense>;
}
