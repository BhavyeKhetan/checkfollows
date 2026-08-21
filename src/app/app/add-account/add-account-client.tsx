"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card } from "@/design-system";
import { AppShell } from "@/components/app/app-shell";
import { track } from "@/lib/mixpanel";

interface PreviewTarget {
  id: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  following_count?: number;
  follower_count?: number;
}

export default function AddAccountClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const searchAccount = async (event: FormEvent) => {
    event.preventDefault();
    const clean = username.replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
      setError("Enter a valid Instagram username.");
      return;
    }
    setLoading(true);
    setError("");
    setTarget(null);
    track("search_submitted", { username: clean, source: "app" });
    try {
      const response = await fetch("/api/instagram/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean, stage: "preview" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success || !json.target?.id) {
        setError(json.error || "That Instagram account could not be found.");
        return;
      }
      setTarget(json.target);
      setUsername(clean);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    if (!target) return;
    setAdding(true);
    setError("");
    try {
      const attach = await fetch("/api/instagram/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, action: "start" }),
      });
      const attachJson = await attach.json().catch(() => ({}));
      if (!attach.ok) {
        setError(attachJson.error || "This account could not be added.");
        return;
      }

      track("tracked_account_added", { username: target.username });
      router.push(`/track/${encodeURIComponent(target.username)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Badge variant="lime" className="mb-3">ADD A TRACKED ACCOUNT</Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)]">Who do you want to monitor?</h1>
        <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
          Search a public Instagram username. They are never notified.
        </p>

        <form onSubmit={searchAccount} className="mt-6 flex gap-2 rounded-2xl border-2 border-[var(--border-dark)] bg-[var(--surface)] p-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
            <Search className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="instagram_username"
              autoCapitalize="none"
              autoCorrect="off"
              className="min-w-0 flex-1 py-2 text-base font-semibold bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
          </div>
          <Button type="submit" variant="primary" isLoading={loading}>Search</Button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
        )}

        {target && (
          <Card variant="highlight" padding="lg" className="mt-5">
            <div className="flex items-center gap-4">
              <Avatar
                src={target.avatar_url || null}
                username={target.username}
                isVerified={target.is_verified === true}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-extrabold text-[var(--foreground)]">{target.full_name || `@${target.username}`}</h2>
                <p className="text-sm font-bold text-[var(--muted-foreground)]">@{target.username}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {(target.following_count || 0).toLocaleString()} following · {(target.follower_count || 0).toLocaleString()} followers
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-5 w-full"
              isLoading={adding}
              onClick={addAccount}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Start tracking @{target.username}
            </Button>
          </Card>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            Only public Instagram accounts can be monitored. CheckFollows never logs into their account or sends them notifications.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
