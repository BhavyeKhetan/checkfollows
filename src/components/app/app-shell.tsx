"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Settings, UserPlus } from "lucide-react";
import { Logo } from "@/design-system";
import { createClient } from "@/lib/supabase/client";
import { reset, track } from "@/lib/mixpanel";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-[#121212] text-white dark:bg-white dark:text-[#121212]"
          : "text-[#555555] hover:text-[#121212] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5]"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppShell({
  children,
  maxWidth = "max-w-3xl",
  actions,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onDashboard = pathname === "/dashboard" || pathname === "/";
  const onAccount =
    pathname === "/account" || pathname.startsWith("/account/");
  const onAdd = pathname.startsWith("/app/add-account");
  const onPricing = pathname.startsWith("/app/pricing");

  const handleSignOut = async () => {
    const supabase = createClient();
    track("signed_out", { platform: "web" });
    await supabase.auth.signOut();
    reset();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background-subtle)] text-[var(--foreground)]">
      <nav className="sticky top-0 z-50 ramp-glass">
        <div
          className={`${maxWidth} mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6`}
        >
          <Logo href="/dashboard" size="sm" />
          <div className="flex items-center gap-0.5 sm:gap-1">
            <NavLink href="/dashboard" active={onDashboard}>
              <LayoutDashboard className="hidden h-3.5 w-3.5 sm:block" />
              Dashboard
            </NavLink>
            <NavLink href="/app/add-account" active={onAdd}>
              <UserPlus className="hidden h-3.5 w-3.5 sm:block" />
              Add
            </NavLink>
            <NavLink href="/account" active={onAccount || onPricing}>
              <Settings className="hidden h-3.5 w-3.5 sm:block" />
              Account
            </NavLink>
            {actions}
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#555555] dark:text-[#A1A1AA] transition-colors hover:text-[#121212] dark:hover:text-[#F5F5F5]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
