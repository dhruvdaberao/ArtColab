'use client';

import { ChangeEvent, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { useAuth } from '@/components/auth-provider';
import { ConfirmModal } from '@/components/confirm-modal';
import { Button, Card, DangerButton, Input, SecondaryButton } from '@/components/ui';
import { deleteAccount, updateProfile } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export default function ProfilePage() {
  const { user, refresh, clearSession } = useAuth();
  const router = useRouter();
  const fileInputId = useId();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageDataUri, setProfileImageDataUri] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'guest') {
      router.push('/');
      return;
    }
    setUsername(user.username);
    setEmail(user.email || '');
  }, [user, router]);

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileImageDataUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmitDelete = useMemo(
    () => deleteConfirmationText === 'DELETE' && deletePassword.trim().length >= 8 && !isDeleting,
    [deleteConfirmationText, deletePassword, isDeleting],
  );

  const handleDeleteAccount = async () => {
    if (!canSubmitDelete) return;

    setDeleteError('');
    setError('');
    setMessage('');
    setIsDeleting(true);

    try {
      const response = await deleteAccount({ confirmationText: 'DELETE', password: deletePassword });
      getSocket().disconnect();
      clearSession();
      router.replace(`/?accountDeleted=1&message=${encodeURIComponent(response.message || 'Your account has been deleted.')}`);
    } catch (deleteRequestError) {
      setDeleteError((deleteRequestError as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user || user.role === 'guest') return null;

  const avatar = profileImageDataUri || user.profileImage;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <SiteHeader compact />
      <div className="space-y-6">
        <Card className="space-y-5 bg-[color:var(--surface)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[color:var(--text-main)]">Your Froddle profile</h1>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Update your saved identity without affecting rooms, auth, or guest behavior.
              </p>
            </div>
            <SecondaryButton onClick={() => router.push('/')}>Back home</SecondaryButton>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start">
            <div className="flex flex-col items-center gap-3 lg:pt-2">
              <label
                htmlFor={fileInputId}
                className="group flex cursor-pointer justify-center px-1 pb-1 focus-within:outline-none"
              >
                <span className="sr-only">Change profile photo</span>
                <span className="relative block h-28 w-28 sm:h-32 sm:w-32">
                  <span className="absolute inset-0 overflow-hidden rounded-full border-2 border-[color:var(--border)] bg-[color:var(--surface-soft)] shadow-[0_10px_30px_rgba(26,26,26,0.12)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_34px_rgba(26,26,26,0.16)] group-focus-within:ring-2 group-focus-within:ring-[color:var(--brand-blue)] group-focus-within:ring-offset-2 group-focus-within:ring-offset-[color:var(--surface)]">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt="Profile"
                        className="absolute inset-0 h-full w-full rounded-full object-cover object-center"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-3xl font-semibold text-[color:var(--primary)]">
                        {user.username.slice(0, 1)}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-70 transition duration-200 group-hover:opacity-100" />
                  </span>
                  <span className="absolute -bottom-1.5 -right-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-[color:var(--text-main)] shadow-[0_4px_10px_rgba(0,0,0,0.15)] transition duration-200 group-hover:scale-105 group-hover:shadow-[0_6px_14px_rgba(0,0,0,0.2)] sm:h-[30px] sm:w-[30px]">
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>
              </label>
              <Input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={onImageChange}
                className="sr-only"
              />
              <p className="text-center text-xs font-semibold tracking-[0.08em] text-[color:var(--text-muted)] uppercase">
                Tap or click the avatar to change photo
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-[color:var(--text-main)]">
                Username
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-sm font-semibold text-[color:var(--text-main)]">
                Email
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
              </label>
              <Button
                onClick={() => {
                  setError('');
                  setMessage('');
                  updateProfile({ username, email, profileImageDataUri })
                    .then((res) => {
                      setMessage(res.message || 'Changes saved');
                      refresh();
                    })
                    .catch((saveError) => setError((saveError as Error).message));
                }}
                className="w-full sm:w-auto"
              >
                Save changes
              </Button>
            </div>
          </div>

          {message && <p className="status-banner status-success">{message}</p>}
          {error && <p className="status-banner status-danger">{error}</p>}
        </Card>

        <Card className="border-[color:var(--brand-red)]/45 bg-[linear-gradient(180deg,rgba(255,247,247,0.96),rgba(255,255,255,0.98))] p-5 shadow-[0_18px_44px_rgba(239,68,68,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-red)]/20 bg-[color:var(--danger-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--brand-red)]">
                <AlertTriangle className="h-3.5 w-3.5" /> Danger zone
              </span>
              <div>
                <h2 className="text-xl font-black text-[color:var(--text-main)]">Delete account</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                  Permanently remove your Froodle account and all rooms you own. This cannot be undone.
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                  Deleting your account will also delete your profile, account data, saved room ownership, and every room you created so no orphaned room data remains.
                </p>
              </div>
            </div>
            <DangerButton className="w-full justify-center sm:w-auto" onClick={() => {
              setDeleteConfirmationText('');
              setDeletePassword('');
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}>
              Delete my account
            </DangerButton>
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={isDeleteModalOpen}
        title="Delete your account?"
        description="This action cannot be undone. Your profile, account data, and all rooms you own will be permanently deleted."
        confirmLabel="Permanently delete account"
        cancelLabel="Keep my account"
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          if (isDeleting) return;
          setIsDeleteModalOpen(false);
          setDeleteError('');
        }}
        destructive
        confirmDisabled={!canSubmitDelete}
        confirmLoading={isDeleting}
      >
        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-[color:var(--brand-red)]/15 bg-[color:var(--danger-soft)]/70 px-4 py-3 text-sm leading-6 text-[color:var(--text-main)]">
            Type <span className="font-black tracking-[0.12em] text-[color:var(--brand-red)]">DELETE</span> and re-enter your password to confirm.
          </div>
          <label className="block text-sm font-semibold text-[color:var(--text-main)]">
            Type DELETE to confirm
            <Input
              value={deleteConfirmationText}
              onChange={(event) => setDeleteConfirmationText(event.target.value.trim())}
              className="mt-1 uppercase"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="DELETE"
              maxLength={6}
            />
          </label>
          <label className="block text-sm font-semibold text-[color:var(--text-main)]">
            Confirm your password
            <Input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="mt-1"
              placeholder="Enter your password"
            />
          </label>
          {deleteError ? <p className="status-banner status-danger">{deleteError}</p> : null}
        </div>
      </ConfirmModal>
    </main>
  );
}
