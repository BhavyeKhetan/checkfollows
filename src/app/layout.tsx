import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { MixpanelProvider } from "@/components/analytics/mixpanel-provider";
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
  metadataBase: new URL("https://www.checkfollows.com"),
  title: "CheckFollows — See who they recently followed on Instagram",
  description:
    "Search any public Instagram account to see who they recently followed and their newest followers. 100% anonymous — no Instagram login needed.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    type: "website",
    url: "https://www.checkfollows.com",
    siteName: "CheckFollows",
    title: "See who they recently followed on Instagram",
    description:
      "Search any public Instagram account to see their recent follows and new followers — 100% anonymous, no login needed.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "CheckFollows — See who they recently followed on Instagram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "See who they recently followed on Instagram",
    description:
      "Search any public Instagram account to see their recent follows and new followers — 100% anonymous, no login needed.",
    images: ["/og.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/icon-96.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="min-h-full flex flex-col bg-[#F9F9F7] text-[#121212]">
        <MixpanelProvider>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </MixpanelProvider>
      </body>
    </html>
  );
}
