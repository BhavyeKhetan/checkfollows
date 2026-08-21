import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | CheckFollows",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
