'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCard, type AuthView } from '@/components/auth-card';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const initialView: AuthView = requestedView === 'register' || requestedView === 'forgot-request' || requestedView === 'forgot-verify' ? requestedView : 'login';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <div className="grid w-full gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-[2rem] border-2 border-black bg-[#f6f1e3] p-8 shadow-[8px_8px_0_rgba(17,24,39,0.08)]">
          <p className="inline-flex items-center rounded-full border-2 border-black bg-[#e7d36f] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]">Realtime creative rooms</p>
          <h1 className="text-5xl font-black leading-tight text-slate-900">Art Colab</h1>
          <p className="max-w-md text-sm text-slate-700">A professional shared canvas for teams and friends. Draw together, stay synced, and move between guest and account mode without friction.</p>
        </section>
        <AuthCard initialView={initialView} />
      </div>
    </main>
  );
}

export default function AuthPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}><AuthPageContent /></Suspense>;
}
