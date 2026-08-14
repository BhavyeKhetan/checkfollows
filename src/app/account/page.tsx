"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Bell,
  ArrowRight,
  Eye,
  History,
  Lock,
} from "lucide-react";
import { Button, Badge, Card, Avatar } from "@/design-system";
import { createClient } from "@/lib/supabase/client";

interface TrackedTarget {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  monitoring_enabled: boolean;
  last_scanned_at: string | null;
  next_scan_at: string | null;
  following_count: number;
  follower_count: number;
}

interface SubscriptionRow {
  id: string;
  plan: string;
  active: boolean;
  user_paused: boolean;
  created_at: string;
  updated_at: string;
  target: TrackedTarget | null;
}

interface AccountData {
  success: boolean;
  user: { id: string; email: string | null };
  hasActiveSubscription: boolean;
  subscriptions: SubscriptionRow[];
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/account");
        return;
      }

      try {
        const res = await fetch("/api/account");
        if (res.status === 401) {
          router.replace("/login?next=/account");
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          if (!json.success) {
            setError(json.error || "Failed to load account");
          } else {
            setData(json);
          }
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const trackedTargets = (data?.subscriptions || [])
    .map((s) => s.target)
    .filter((t): t is TrackedTarget => !!t);

  const planLabel = (plan: string) =>
    plan === "pro" ? "Pro (with email alerts)" : "Monitoring";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg text-[#121212] hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
              <Zap className="w-4 h-4 fill-current text-[#E7F256]" />
            </div>
            <span className="tracking-tight text-xl font-extrabold">CheckFollows</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold text-[#555555] hover:text-[#121212] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 space-y-6">
        {/* Account header */}
        <div>
          <Badge variant="mono" size="sm" className="mb-3">
            YOUR ACCOUNT
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212]">
            {data?.user.email || "Account"}
          </h1>
          <p className="text-sm text-[#555555] mt-1 font-medium">
            Manage your subscription and tracked accounts.
          </p>
        </div>

        {error && (
          <Card variant="subtle" className="border-[#FCA5A5]">
            <p className="text-sm text-[#B91C1C] font-medium">{error}</p>
          </Card>
        )}

        {/* Subscription status */}
        <Card
          variant={data?.hasActiveSubscription ? "highlight" : "subtle"}
          padding="lg"
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                data?.hasActiveSubscription
                  ? "bg-[#121212] text-[#E7F256]"
                  : "bg-[#EDEDE8] text-[#555555]"
              }`}
            >
              {data?.hasActiveSubscription ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-[#121212]">
                {data?.hasActiveSubscription ? "Active subscription" : "No active subscription"}
              </h2>
              <p className="text-sm text-[#555555] mt-0.5">
                {data?.hasActiveSubscription
                  ? `${planLabel(
                      data.subscriptions.find((s) => s.active)?.plan || "basic"
                    )} · daily monitoring enabled`
                  : "Subscribe to unlock full following lists and daily monitoring."}
              </p>
            </div>
            {!data?.hasActiveSubscription && (
              <Link href="/pricing">
                <Button
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Subscribe
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {/* Tracked accounts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-[#121212]">
              Tracked accounts ({trackedTargets.length})
            </h2>
            {data?.hasActiveSubscription && (
              <Link href="/" className="text-xs font-bold text-[#121212] underline underline-offset-2">
                + Add account
              </Link>
            )}
          </div>

          {trackedTargets.length === 0 ? (
            <Card variant="subtle" className="text-center py-10">
              <Eye className="w-8 h-8 text-[#555555] mx-auto mb-3" />
              <p className="text-sm text-[#555555] font-medium max-w-xs mx-auto">
                You&apos;re not tracking anyone yet. Search a profile to start
                watching who they follow.
              </p>
              <Link href="/" className="inline-block mt-4">
                <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Search a profile
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {trackedTargets.map((t) => (
                <Card key={t.id} hoverable padding="md" className="flex items-center gap-4">
                  <Avatar
                    src={t.avatar_url}
                    username={t.username}
                    isVerified={t.is_verified}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#121212] truncate">
                        {t.full_name || `@${t.username}`}
                      </span>
                      <Badge variant="mono" size="sm">@{t.username}</Badge>
                    </div>
                    <p className="text-xs text-[#555555] mt-0.5 flex items-center gap-2">
                      <span>
                        {t.following_count.toLocaleString()} following
                      </span>
                      <span className="text-[#E2E2DC]">·</span>
                      <span>Last checked {formatRelative(t.last_scanned_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.monitoring_enabled ? (
                      <Badge variant="lime" size="sm" className="flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Monitoring
                      </Badge>
                    ) : (
                      <Badge variant="mono" size="sm">Paused</Badge>
                    )}
                    <Link href={`/track/${encodeURIComponent(t.username)}`}>
                      <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Value strip */}
        <Card variant="subtle" padding="lg" className="grid sm:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-[#121212] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">Change alerts</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                Emailed the moment they follow or unfollow someone.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <History className="w-5 h-5 text-[#121212] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">Accumulating history</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                Every check builds a permanent timeline.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-[#121212]">100% private</h3>
              <p className="text-xs text-[#555555] mt-0.5">
                The people you track are never notified.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
