import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://froodle.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: 'Froddle',
  description: 'Playful real-time collaborative drawing rooms with frog-powered energy',
  applicationName: 'Froddle',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    shortcut: ['/icon'],
  },
};

export const viewport: Viewport = {
  themeColor: '#19a7ff',
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
