"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button, Input, Badge, Logo } from "@/design-system";
import { createClient } from "@/lib/supabase/client";

function isValidEmail(val: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
}

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefillEmail = searchParams.get("email") || "";
  const next = searchParams.get("next") || "/account";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ready = isValidEmail(email) && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : signInError.message
      );
      setLoading(false);
      return;
    }

    router.replace(next.startsWith("/") ? next : "/account");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* Header */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/signup"
            className="text-xs font-bold text-[#555555] hover:text-[#121212] transition-colors"
          >
            Create account
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-10">
        <div className="text-center mb-8">
          <Badge variant="mono" size="sm" className="mb-4">
            WELCOME BACK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121212] leading-tight">
            Sign in to CheckFollows
          </h1>
          <p className="text-[#555555] text-sm font-medium max-w-xs mx-auto mt-3">
            Pick up your tracking history and change alerts right where you left
            off.
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
          <Input
            type={showPassword ? "text" : "password"}
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
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

          {error && (
            <p className="text-xs text-[#B91C1C] font-semibold">{error}</p>
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
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-[#555555] font-medium mt-8">
          No account yet?{" "}
          <Link
            href={`/signup${prefillEmail ? `?email=${encodeURIComponent(prefillEmail)}` : ""}`}
            className="text-[#121212] font-bold underline underline-offset-2"
          >
            Create one
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
