import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  astonScript,
  barriecito,
  bebasNeue,
  consolaMono,
  gabrielSerif,
  lemonMilk,
  recoleta,
} from "./fonts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ToDoBingo",
  description: "A Next.js + Tailwind CSS web app.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops iOS zooming the whole page when a small input takes focus — the
  // panels' inputs render under 16px at phone scale, which is the trigger.
  // Pinch zoom stays available; user-scalable is deliberately left alone.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${consolaMono.variable} ${recoleta.variable} ${barriecito.variable} ${astonScript.variable} ${gabrielSerif.variable} ${bebasNeue.variable} ${lemonMilk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
