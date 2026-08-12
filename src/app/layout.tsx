import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CheckFollows — See who they recently followed on Instagram",
  description:
    "Enter any public Instagram username to see recent follows, recent followers, and track changes over time. No Instagram login required.",
  openGraph: {
    title: "CheckFollows — See who they recently followed on Instagram",
    description:
      "Enter any public Instagram username to see recent follows and recent followers. Private search, no login required.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CheckFollows — See who they recently followed on Instagram",
    description:
      "Enter any public Instagram username to see recent follows and recent followers. No login required.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F9F9F7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col bg-[#F9F9F7] text-[#121212]">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
