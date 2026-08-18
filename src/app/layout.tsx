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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
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
