import frogIcon from '../../frog icon.png';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Froddle',
  description: 'Playful real-time collaborative drawing rooms with frog-powered energy',
  icons: {
    icon: frogIcon.src
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[color:var(--bg)] text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
