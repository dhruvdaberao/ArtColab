import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { RouteOrientationGuard } from "@/components/route-orientation-guard";
import frogIcon from "../../frog icon.png";
import "./globals.css";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://froodle.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Froddle",
  description:
    "Playful real-time collaborative drawing rooms with frog-powered energy",
  applicationName: "Froddle",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Froddle",
  },
  icons: {
    icon: [{ url: frogIcon.src, type: "image/png", sizes: "1200x1200" }],
    apple: [{ url: frogIcon.src, type: "image/png", sizes: "1200x1200" }],
    shortcut: [{ url: frogIcon.src, type: "image/png", sizes: "1200x1200" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08111b",
  colorScheme: "light",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[color:var(--bg)] text-slate-900">
        <RouteOrientationGuard />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
