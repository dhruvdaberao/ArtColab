import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CloudCanvas',
  description: 'Temporary real-time collaborative drawing rooms'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
