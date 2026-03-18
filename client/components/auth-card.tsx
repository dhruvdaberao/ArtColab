'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button, Card, Input, SecondaryButton, SuccessButton } from '@/components/ui';
import { requestResetCode, verifyResetCode } from '@/lib/api';

export type AuthView = 'login' | 'register' | 'forgot-request' | 'forgot-verify';

export function AuthCard({ initialView = 'login', redirectTo = '/' }: { initialView?: AuthView; redirectTo?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, user } = useAuth();
  const [view, setView] = useState<AuthView>(initialView);
  const [error, setError] = useState<string | null>(null);
  const [emailForReset, setEmailForReset] = useState('');

  const authRedirect = useMemo(() => searchParams.get('redirect') || redirectTo, [searchParams, redirectTo]);

  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => { if (user?.role === 'user') router.replace(authRedirect); }, [user, router, authRedirect]);
  const onSuccess = () => router.replace(authRedirect);

  return <Card className="space-y-4 bg-[color:var(--surface)] p-5 sm:p-6">
    <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Account access</p><h1 className="text-3xl font-black text-[color:var(--text-main)]">Froddle</h1><p className="text-sm text-[color:var(--text-muted)]">Sign in or create an account to keep your Froddle identity, room history, and profile settings.</p></div>
    <div className="flex flex-wrap gap-2 rounded-[1.25rem] border-2 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
      <button type="button" onClick={() => { setError(null); setView('login'); }} className={`min-w-[8rem] flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition ${view === 'login' || view === 'forgot-request' || view === 'forgot-verify' ? 'bg-[color:var(--brand-blue)] text-[color:var(--surface)] shadow-[0_4px_0_rgba(26,26,26,0.14)]' : 'text-[color:var(--text-main)] hover:bg-white/70'}`}>🔐 Login</button>
      <button type="button" onClick={() => { setError(null); setView('register'); }} className={`min-w-[8rem] flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition ${view === 'register' ? 'bg-[color:var(--brand-green)] text-[color:var(--surface)] shadow-[0_4px_0_rgba(26,26,26,0.14)]' : 'text-[color:var(--text-main)] hover:bg-white/70'}`}>✨ Create account</button>
    </div>
    {view === 'login' && <LoginForm onSubmit={async (i,p)=>{ await login(i,p); onSuccess(); }} onForgot={() => setView('forgot-request')} setError={setError} />}
    {view === 'register' && <RegisterForm onSubmit={async (e,u,p,c)=>{ await register(e,u,p,c); onSuccess(); }} setError={setError} />}
    {view === 'forgot-request' && <ForgotRequest setError={setError} onSent={(email)=>{ setEmailForReset(email); setView('forgot-verify'); }} onBack={() => setView('login')} />}
    {view === 'forgot-verify' && <ForgotVerify email={emailForReset} setError={setError} onBack={() => setView('login')} />}
    {error && <p className="status-banner status-danger">{error}</p>}
    <SecondaryButton className="w-full" onClick={() => router.push('/')}>🏠 Back to Froddle home</SecondaryButton>
  </Card>;
}

function LoginForm({ onSubmit, onForgot, setError }: { onSubmit: (i: string, p: string) => Promise<void>; onForgot: () => void; setError: (v: string | null) => void }) {
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [submitting, setSubmitting] = useState(false);
  return <form className="space-y-3" onSubmit={(e)=>{e.preventDefault(); setError(null); setSubmitting(true); onSubmit(identifier.trim(), password).catch((err)=>setError((err as Error).message)).finally(()=>setSubmitting(false));}}>
    <Input placeholder="Email or username" value={identifier} onChange={(e)=>setIdentifier(e.target.value)} autoComplete="username" />
    <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" />
    <Button className="w-full" disabled={submitting}>{submitting ? 'Logging in…' : '🔐 Login'}</Button>
    <button type="button" onClick={onForgot} className="text-sm font-medium text-[color:var(--brand-blue)] underline underline-offset-2">Forgot password?</button>
  </form>;
}

function RegisterForm({ onSubmit, setError }: { onSubmit: (e: string, u: string, p: string, c: string) => Promise<void>; setError: (v: string | null) => void }) {
  const [email, setEmail] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [submitting, setSubmitting] = useState(false);
  return <form className="space-y-3" onSubmit={(e)=>{e.preventDefault(); setError(null); setSubmitting(true); onSubmit(email.trim(), username.trim(), password, confirm).catch((err)=>setError((err as Error).message)).finally(()=>setSubmitting(false));}}>
    <Input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
    <Input placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" />
    <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" />
    <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password" />
    <SuccessButton className="w-full" disabled={submitting}>{submitting ? 'Creating account…' : '✨ Create account'}</SuccessButton>
  </form>;
}

function ForgotRequest({ onBack, onSent, setError }: { onBack: () => void; onSent: (email: string) => void; setError: (v: string | null) => void }) {
const [email,setEmail]=useState(''); const [message,setMessage]=useState(''); const [submitting,setSubmitting]=useState(false);
return <form className="space-y-3" onSubmit={(e)=>{e.preventDefault(); setError(null); setSubmitting(true); requestResetCode(email.trim()).then((res)=>{setMessage(res.message); onSent(email.trim());}).catch((err)=>setError((err as Error).message)).finally(()=>setSubmitting(false));}}>
  <Input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
  <Button className="w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset code'}</Button>
  {message && <p className="text-xs text-[color:var(--text-muted)]">{message}</p>}
  <button type="button" onClick={onBack} className="block text-sm text-[color:var(--text-main)]">Back</button>
</form> }

function ForgotVerify({ email, onBack, setError }: { email: string; onBack: () => void; setError: (v: string | null) => void }) {
const [code,setCode]=useState(''); const [password,setPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [message,setMessage]=useState(''); const [submitting,setSubmitting]=useState(false);
return <form className="space-y-3" onSubmit={(e)=>{e.preventDefault(); setError(null); setSubmitting(true); verifyResetCode({ email, code, password, confirmPassword }).then((res)=>setMessage(res.message)).catch((err)=>setError((err as Error).message)).finally(()=>setSubmitting(false));}}>
<Input value={email} disabled /><Input placeholder="6-digit code" value={code} onChange={(e)=>setCode(e.target.value)} maxLength={6} /><Input type="password" placeholder="New password" value={password} onChange={(e)=>setPassword(e.target.value)} /><Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} />
<Button className="w-full" disabled={submitting}>{submitting ? 'Resetting…' : 'Reset password'}</Button>{message && <p className="text-xs text-[color:var(--success)]">{message}</p>}<button type="button" onClick={onBack} className="block text-sm text-[color:var(--text-main)]">Back to login</button></form> }
