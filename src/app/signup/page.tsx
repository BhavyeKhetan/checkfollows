"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button, Input, Badge, Logo } from "@/design-system";
import { createClient } from "@/lib/supabase/client";
import { track, identify } from "@/lib/mixpanel";

function isValidEmail(val: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
}

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefillEmail = searchParams.get("email") || "";
  const username = searchParams.get("username") || "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    track("signup_viewed", {
      has_username: !!username,
      has_prefill_email: !!prefillEmail,
    });
  }, [username, prefillEmail]);

  const ready = isValidEmail(email) && password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    track("signup_submitted", { has_username: !!username });

    if (!isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create account.");
        track("signup_error", { error: data.error || "failed" });
        setLoading(false);
        return;
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        if (data.exists) {
          setError(
            "This email already has an account — sign in instead."
          );
        } else {
          setError(signInError.message || "Failed to sign in.");
        }
        track("signup_error", { error: signInError.message || "signin_failed" });
        setLoading(false);
        return;
      }

      const userId = signInData.user?.id;
      if (userId) {
        identify(userId, { $email: signInData.user?.email ?? undefined });
        track("sign_up_completed", {
          sign_up_method: "email",
          platform: "web",
          is_first_time: true,
          has_username: !!username,
        });
      }

      router.replace("/account");
    } catch {
      setError("Something went wrong. Please try again.");
      track("signup_error", { error: "network" });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/login"
            className="text-xs font-bold text-[#555555] hover:text-[#121212] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-10">
        <div className="text-center mb-8">
          <Badge variant="lime" size="sm" className="mb-4">
            ALMOST THERE
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight">
            {username ? `Create your account to view @${username}` : "Create your account"}
          </h1>
          <p className="text-[#555555] text-sm font-medium max-w-xs mx-auto mt-3">
            Your subscription and tracking history live here. One password and
            you&apos;re in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="off"
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[#555555] hover:text-[#121212] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
            />
          </div>
          <Input
            type={showPassword ? "text" : "password"}
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />

          {error && (
            <p className="text-xs text-[#B91C1C] font-semibold flex items-center gap-1.5">
              <span>⚠</span> {error}
              {error.includes("already has an account") && (
                <Link href={`/login${prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : ""}`} className="underline font-bold">
                  Sign in
                </Link>
              )}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!ready}
            isLoading={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="font-extrabold"
          >
            Create account
          </Button>

          <p className="text-[11px] text-[#777777] font-medium flex items-center justify-center gap-1.5 pt-1">
            <Lock className="w-3 h-3 text-[#047857]" /> Your data stays private · no spam
          </p>
        </form>

        <p className="text-center text-sm text-[#555555] font-medium mt-8">
          Already have an account?{" "}
          <Link
            href={`/login${prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : ""}`}
            className="text-[#121212] font-bold underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
