"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Shield,
  ArrowRight,
  ArrowDown,
  Menu,
  X,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Heart,
  TrendingUp,
  Briefcase,
  Star,
} from "lucide-react";
import type { SearchState, FollowEntry } from "@/lib/types";
import {
  Button,
  Badge,
  Card,
  Input,
  Tabs,
  StatCard,
  Avatar,
  AccordionItem,
} from "@/design-system";

// ─── Mock demo data ────────────────────────────────────────────────

const DEMO_FOLLOWING: FollowEntry[] = [
  { id: "1", username: "emma.wilson", fullName: "Emma Wilson", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "2", username: "sophia.martinez", fullName: "Sophia Martinez", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "3", username: "olivia.j", fullName: "Olivia Johnson", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "4", username: "mia.b", fullName: "Mia Brown", avatarUrl: null, isVerified: false, isPrivate: true },
  { id: "5", username: "isabella.fit", fullName: "Isabella Fitness", avatarUrl: null, isVerified: true, isPrivate: false },
  { id: "6", username: "charlotte.style", fullName: "Charlotte Style", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "7", username: "amelia.rose", fullName: "Amelia Rose", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "8", username: "harper.lee", fullName: "Harper Lee", avatarUrl: null, isVerified: true, isPrivate: false },
];

const DEMO_FOLLOWERS: FollowEntry[] = [
  { id: "f1", username: "sarah.jane", fullName: "Sarah Jane", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "f2", username: "ava.taylor", fullName: "Ava Taylor", avatarUrl: null, isVerified: true, isPrivate: false },
  { id: "f3", username: "luna.m", fullName: "Luna M.", avatarUrl: null, isVerified: false, isPrivate: false },
  { id: "f4", username: "zoe.anderson", fullName: "Zoe Anderson", avatarUrl: null, isVerified: false, isPrivate: true },
  { id: "f5", username: "layla.k", fullName: "Layla K.", avatarUrl: null, isVerified: false, isPrivate: false },
];

// ─── Testimonials Data with Real Avatars ───────────────────────────

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    role: "Verified Searcher",
    avatar: "/images/testimonials/marcus.jpg",
    rating: 5,
    quote:
      "I thought the IG following list was chronological inside the app. Turns out Instagram completely scrambles it! CheckFollows actually revealed the true order in 5 seconds.",
  },
  {
    name: "Sarah K.",
    role: "Verified Searcher",
    avatar: "/images/testimonials/sarah.jpg",
    rating: 5,
    quote:
      "Finally a tool that doesn't ask me for my Instagram password or make me download sketchy software. Completely private and works right in the browser.",
  },
  {
    name: "Elena R.",
    role: "Digital Marketer",
    avatar: "/images/testimonials/elena.jpg",
    rating: 5,
    quote:
      "I use this to keep tabs on influencer networking and new brand connections before competitors notice. The chronological sorting is 100% spot on.",
  },
];

// ─── Component Helpers ─────────────────────────────────────────────

function FollowCard({
  entry,
  label,
}: {
  entry: FollowEntry;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-[#F8F8F5] transition-all cursor-pointer group border border-transparent hover:border-[#E2E2DC]">
      <Avatar username={entry.username} isVerified={entry.isVerified} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate text-[#121212] group-hover:text-[#000000] transition-colors">
            {entry.username}
          </span>
        </div>
        <p className="text-xs text-[#555555] truncate">
          {entry.fullName || `@${entry.username}`}
        </p>
      </div>
      <Badge variant="lime" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </Badge>
    </div>
  );
}

function BlurredFollowCard() {
  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-xl relative overflow-hidden">
      <div className="w-10 h-10 rounded-full bg-[#EDEDE8] blur-[6px] border border-[#E2E2DC]" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 bg-[#EDEDE8] rounded blur-[4px]" />
        <div className="h-2.5 w-20 bg-[#EDEDE8] rounded blur-[4px]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFFFFF]/70 to-transparent" />
    </div>
  );
}

// ─── FAQ Data ──────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Do I need to log into Instagram to use CheckFollows?",
    a: "No. You never need to enter your Instagram credentials. We only access public data that Instagram makes available.",
  },
  {
    q: "Will the person know I checked their profile?",
    a: "No. CheckFollows does not interact with Instagram on your behalf. The person you search will not be notified in any way.",
  },
  {
    q: "Can I check a private Instagram account?",
    a: "No. CheckFollows only works with public Instagram accounts. If an account is private, we'll tell you immediately.",
  },
  {
    q: "Why is the native Instagram following list scrambled?",
    a: "Instagram intentionally scrambles following and follower order using mutual connections and secret algorithm weights. CheckFollows bypasses the algorithm to sort by true chronological order.",
  },
  {
    q: "How much does it cost?",
    a: "CheckFollows is $12.99/week. You can search, preview results, and then subscribe to unlock the full list, followers, and change tracking.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription at any time with 1-click and your access will continue until the end of your billing period.",
  },
];

// ─── Main Page ─────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
    profile: null,
    recentFollowing: null,
    recentFollowers: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"following" | "followers">("following");
  const [demoTab, setDemoTab] = useState<"following" | "followers">("following");
  const [showDemo, setShowDemo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showEmptyPrompt, setShowEmptyPrompt] = useState(false);
  const [showStickySearch, setShowStickySearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const handleSearch = async () => {
    const username = searchInput.replace(/^@/, "").trim();
    if (!username) return;

    setSearchState({ status: "loading", profile: null, recentFollowing: null, recentFollowers: null, error: null });

    try {
      const profileRes = await fetch(
        `/api/instagram/profile?username=${encodeURIComponent(username)}`
      );
      const profileData = await profileRes.json();

      if (!profileRes.ok || !profileData.success) {
        if (profileData.isPrivate) {
          setSearchState((prev) => ({
            ...prev,
            status: "private",
            profile: profileData.profile,
            error: null,
          }));
        } else if (profileData.notFound) {
          setSearchState((prev) => ({ ...prev, status: "not_found", error: null }));
        } else {
          setSearchState((prev) => ({
            ...prev,
            status: "error",
            error: profileData.error || "Something went wrong",
          }));
        }
        return;
      }

      setSearchState((prev) => ({
        ...prev,
        status: "preview",
        profile: profileData.profile,
        error: null,
      }));

      const followsRes = await fetch(
        `/api/instagram/follows?username=${encodeURIComponent(username)}`
      );
      const followsData = await followsRes.json();

      if (followsData.success) {
        setSearchState((prev) => ({
          ...prev,
          recentFollowing: followsData.recentFollowing || [],
          recentFollowers: followsData.recentFollowers || [],
        }));
      }
    } catch {
      setSearchState((prev) => ({
        ...prev,
        status: "error",
        error: "Network error. Please try again.",
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowDemo(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Empty prompt animation: after 4s of idle with empty input, show the prompt
  useEffect(() => {
    if (searchState.status !== "idle" || searchInput.trim()) {
      const timer = setTimeout(() => setShowEmptyPrompt(false), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setShowEmptyPrompt(true), 4000);
    return () => clearTimeout(timer);
  }, [searchState.status, searchInput]);

  // Mobile sticky search: show when hero scrolls past
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      // Show sticky bar when hero bottom is above viewport
      setShowStickySearch(rect.bottom < 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const renderResultSection = () => {
    if (
      searchState.status === "idle" ||
      searchState.status === "loading" ||
      searchState.status === "profile"
    )
      return null;

    const isPaid = searchState.status === "full";
    const following = searchState.recentFollowing || [];
    const followers = searchState.recentFollowers || [];
    const displayList = activeTab === "following" ? following : followers;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg mx-auto mt-8 text-left"
      >
        {/* Profile header card */}
        {searchState.profile && (
          <Card variant="highlight" className="mb-4">
            <div className="flex items-center gap-4">
              <Avatar
                username={searchState.profile.username}
                isVerified={searchState.profile.isVerified}
                size="lg"
                limeHalo
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg truncate text-[#121212]">
                    {searchState.profile.fullName || searchState.profile.username}
                  </h3>
                </div>
                <p className="text-xs text-[#555555]">@{searchState.profile.username}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#555555]">
                  <span>
                    <strong className="text-[#121212]">
                      {searchState.profile.followingCount.toLocaleString()}
                    </strong>{" "}
                    following
                  </span>
                  <span>
                    <strong className="text-[#121212]">
                      {searchState.profile.followerCount.toLocaleString()}
                    </strong>{" "}
                    followers
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tab switcher */}
        <div className="mb-4">
          <Tabs
            fullWidth
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as "following" | "followers")}
            tabs={[
              { id: "following", label: "Recent Following", badge: following.length },
              { id: "followers", label: "Recent Followers", badge: followers.length },
            ]}
          />
        </div>

        {/* Results container */}
        <Card padding="none" className="overflow-hidden bg-[#FFFFFF]">
          <div className="p-2 space-y-1">
            {displayList.slice(0, isPaid ? displayList.length : 3).map((entry) => (
              <FollowCard
                key={entry.id}
                entry={entry}
                label={activeTab === "following" ? "Followed" : "Follows them"}
              />
            ))}
          </div>

          {/* Paywall Overlay */}
          {!isPaid && displayList.length > 3 && (
            <div className="relative">
              <div className="p-2 space-y-1">
                {displayList.slice(3, 8).map((_, i) => (
                  <BlurredFollowCard key={i} />
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF]/95 to-transparent pt-16 pb-8 px-4 text-center">
                <Badge variant="lime" dot pulse className="mb-2">
                  <Lock className="w-3 h-3 mr-1" />
                  {displayList.length - 3}+ accounts hidden
                </Badge>
                <p className="text-xs text-[#555555] mb-4 max-w-xs font-medium">
                  Unlock full access to see all recent activity, follower order changes &amp; alerts.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Eye className="w-4 h-4" />}
                  onClick={() => {
                    router.push("/api/stripe/checkout");
                  }}
                >
                  Unlock for $12.99/week
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {displayList.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-[#555555] text-sm font-medium">
                No {activeTab === "following" ? "following" : "follower"} records found.
              </p>
              <p className="text-[#888888] text-xs mt-1">
                Data will refresh automatically upon next update.
              </p>
            </div>
          )}
        </Card>

        {/* Tracking CTA for paid users */}
        {isPaid && (
          <Button
            variant="secondary"
            fullWidth
            className="mt-4"
            leftIcon={<Bell className="w-4 h-4 text-[#121212]" />}
          >
            Track this account for live changes
          </Button>
        )}
      </motion.div>
    );
  };

  const renderStatusState = () => {
    switch (searchState.status) {
      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-lg mx-auto mt-8 text-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-3 border-[#121212] border-t-[#E7F256] animate-spin" />
              <p className="text-[#555555] text-sm font-semibold">Analyzing public data...</p>
              <div className="space-y-2 w-full">
                <div className="h-3.5 ramp-shimmer rounded-lg w-3/4 mx-auto" />
                <div className="h-3.5 ramp-shimmer rounded-lg w-1/2 mx-auto" />
              </div>
            </div>
          </motion.div>
        );

      case "private":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8"
          >
            <Card variant="subtle" className="text-center border-[#FDE68A]">
              <EyeOff className="w-10 h-10 text-[#B45309] mx-auto mb-3" />
              <h3 className="font-bold text-[#121212] text-base mb-1">Private Account</h3>
              <p className="text-sm text-[#555555]">
                This account is private. CheckFollows strictly operates on public Instagram data.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-[#121212]"
                onClick={() =>
                  setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
                }
              >
                Try another username
              </Button>
            </Card>
          </motion.div>
        );

      case "not_found":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8"
          >
            <Card variant="subtle" className="text-center border-[#FCA5A5]">
              <Search className="w-10 h-10 text-[#B91C1C] mx-auto mb-3" />
              <h3 className="font-bold text-[#121212] text-base mb-1">Account Not Found</h3>
              <p className="text-sm text-[#555555]">
                We couldn&apos;t find an Instagram account with that handle. Double-check spelling.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-[#121212]"
                onClick={() =>
                  setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
                }
              >
                Try again
              </Button>
            </Card>
          </motion.div>
        );

      case "error":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8 text-center"
          >
            <Card variant="subtle" className="border-[#FCA5A5]">
              <p className="text-sm text-[#B91C1C]">{searchState.error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-[#121212]"
                onClick={() =>
                  setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
                }
              >
                Try again
              </Button>
            </Card>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const demoList = demoTab === "following" ? DEMO_FOLLOWING : DEMO_FOLLOWERS;

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#121212]">
      {/* ── Navigation Header ── */}
      <nav className="sticky top-0 z-50 ramp-glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg text-[#121212] hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
              <Zap className="w-4 h-4 fill-current text-[#E7F256]" />
            </div>
            <span className="tracking-tight text-xl font-extrabold">CheckFollows</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#truth-section"
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              The Instagram Trap
            </a>
            <a
              href="#comparison"
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              Comparison
            </a>
            <a
              href="#use-cases"
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              Use Cases
            </a>
            <a
              href="#testimonials"
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              Reviews
            </a>
            <a
              href="#faq"
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              FAQ
            </a>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                focusInput();
              }}
            >
              Check followers anonymously
            </Button>
            <Button
              variant="dark"
              size="sm"
              onClick={() => {
                focusInput();
              }}
            >
              Inspect handle
            </Button>
          </div>

          {/* Mobile menu trigger */}
          <button
            className="sm:hidden p-2 text-[#555555] hover:text-[#121212]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden border-t border-[#E2E2DC] bg-[#FFFFFF]"
            >
              <div className="px-4 py-4 space-y-3">
                <a
                  href="#truth-section"
                  className="block text-sm font-semibold text-[#555555] hover:text-[#121212]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  The Instagram Trap
                </a>
                <a
                  href="#comparison"
                  className="block text-sm font-semibold text-[#555555] hover:text-[#121212]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Comparison
                </a>
                <a
                  href="#use-cases"
                  className="block text-sm font-semibold text-[#555555] hover:text-[#121212]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Use Cases
                </a>
                <a
                  href="#testimonials"
                  className="block text-sm font-semibold text-[#555555] hover:text-[#121212]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Reviews
                </a>
                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      setMobileMenuOpen(false);
                      inputRef.current?.focus();
                      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    Check followers anonymously
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── CheckFollows Hero Section ── */}
      <section className="relative ramp-grid-bg pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 border-b border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto text-center relative flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 flex justify-center"
          >
            <Badge variant="mono" size="md">
              100% ANONYMOUS SEARCH &bull; ZERO INSTAGRAM LOGIN NEEDED
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#121212] leading-[1.05] max-w-3xl mx-auto text-center"
          >
            See who they <br className="hidden sm:block" />
            <span className="bg-[#E7F256] text-[#121212] px-2.5 py-0.5 rounded-xl border border-black/10 inline-block">
              recently followed
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-[#555555] max-w-xl mx-auto leading-relaxed font-medium"
          >
            Enter any Instagram handle to inspect recent follows, new followers, and activity order changes in seconds.
          </motion.p>

          {/* Hero Search Box — prominent, animated */}
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 max-w-xl mx-auto"
          >
            <div className={`relative rounded-2xl transition-shadow duration-500 ${showEmptyPrompt ? "shadow-[0_0_0_3px_rgba(210,255,82,0.4),0_8px_32px_rgba(0,0,0,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.08)]"}`}>
              {/* Pulsing border ring when idle */}
              {showEmptyPrompt && (
                <motion.div
                  className="absolute -inset-[3px] rounded-2xl pointer-events-none"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ boxShadow: "0 0 0 3px rgba(210,255,82,0.5), 0 0 30px rgba(210,255,82,0.15)" }}
                />
              )}
              <Card padding="lg" className="shadow-none border-[#E2E2DC] relative z-10 bg-[#FFFFFF]">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Input
                      ref={inputRef}
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter Instagram handle..."
                      leftIcon={<span className="text-[#121212] font-extrabold text-lg">@</span>}
                      className="border-none bg-transparent py-4 text-lg font-medium placeholder:text-[#9CA3AF] focus:ring-0"
                      spellCheck={false}
                      autoCapitalize="off"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSearch}
                    isLoading={searchState.status === "loading"}
                    disabled={!searchInput.trim()}
                    rightIcon={<ArrowRight className="w-5 h-5" />}
                    className="sm:w-auto font-extrabold text-base shadow-lg hover:shadow-xl"
                  >
                    Check followers anonymously
                  </Button>
                </div>
              </Card>
            </div>

            {/* Empty prompt animation */}
            <AnimatePresence>
              {showEmptyPrompt && searchState.status === "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center justify-center gap-2 mt-3 text-sm font-semibold text-[#555555]"
                >
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowDown className="w-4 h-4 text-[#C2F84F]" />
                  </motion.span>
                  Type a public Instagram handle above to get started
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trust badges */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#555555]">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#047857]" /> 100% Private &amp; Untraceable
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#121212]" /> Zero IG Password Needed
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-[#121212]" /> Target Is Never Alerted
              </span>
            </div>
          </motion.div>

          {/* Results section */}
          {renderStatusState()}
          {renderResultSection()}
        </div>
      </section>

      {/* ── Ramp Light Live Ticker Bar ── */}
      <section className="bg-[#FFFFFF] border-b border-[#E2E2DC] py-3.5 px-4 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between whitespace-nowrap gap-8 text-xs font-mono text-[#555555]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E7F256] border border-black/30 animate-pulse" />
            <span className="font-bold text-[#121212]">LIVE METRICS:</span>
          </div>
          <div>
            PROFILES CHECKED TODAY: <strong className="text-[#121212] font-bold">2,809,713</strong>
          </div>
          <div>
            RECENT FOLLOWS DETECTED: <strong className="text-[#121212] font-bold">2,552,293</strong>
          </div>
          <div>
            INSTAGRAM LOGIN NEEDED: <strong className="text-[#121212] font-bold">ZERO</strong>
          </div>
          <div>
            PRIVACY STATUS: <strong className="text-[#121212] font-bold">100% ANONYMOUS</strong>
          </div>
        </div>
      </section>

      {/* ── Ca$hvertising Upgrade 1: The Instagram Trap (Category Inoculation) ── */}
      <section id="truth-section" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#F9F9F7] border-b border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <Badge variant="mono" size="sm" className="mb-3">
              THE INSTAGRAM TRAP EXPLAINED
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              Why searching inside the Instagram app lies to you
            </h2>
            <p className="mt-3 text-[#555555] font-medium max-w-xl mx-auto">
              Instagram intentionally scrambles the following list order. Here is how CheckFollows gets you the truth safely.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-[#FFFFFF] border-red-200">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-4 text-[#B91C1C]">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-2">1. The Native App Fallacy</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                When you tap &quot;Following&quot; in Instagram, the list is <strong>scrambled by algorithm weights</strong> and mutual friends. It is NOT chronological. You miss true recent follows.
              </p>
            </Card>

            <Card className="bg-[#FFFFFF] border-amber-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4 text-[#B45309]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-2">2. Sketchy Password Spy Apps</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Most online &quot;IG tracker apps&quot; demand your Instagram password or require suspicious APK downloads &ndash; risking your account getting <strong>banned, hacked, or shadowbanned</strong>.
              </p>
            </Card>

            <Card variant="highlight" className="bg-[#FFFFFF]">
              <div className="w-10 h-10 rounded-xl bg-[#E7F256] border border-black/10 flex items-center justify-center mb-4 text-[#121212]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-2">3. The CheckFollows Solution</h3>
              <p className="text-xs text-[#121212] leading-relaxed font-medium">
                We parse public dataset order with <strong>zero passwords needed</strong>. You get 100% true chronological order with complete anonymity.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Ca$hvertising Upgrade 2: Comparison Matrix ── */}
      <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#FFFFFF] border-b border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <Badge variant="mono" size="sm" className="mb-3">
              SIDE-BY-SIDE COMPARISON
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              CheckFollows vs. Native IG vs. Other Apps
            </h2>
          </motion.div>

          <Card padding="none" className="overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F9F9F7] border-b border-[#E2E2DC]">
                    <th className="p-4 font-extrabold text-[#121212]">Feature / Safety standard</th>
                    <th className="p-4 font-semibold text-[#555555] text-center">Native IG App</th>
                    <th className="p-4 font-semibold text-[#555555] text-center">Sketchy Spy Apps</th>
                    <th className="p-4 font-extrabold text-[#121212] text-center bg-[#E7F256]/30">CheckFollows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E2DC]">
                  <tr>
                    <td className="p-4 font-bold text-[#121212]">True Chronological Sorting</td>
                    <td className="p-4 text-center text-red-500 font-bold">❌ Scrambled</td>
                    <td className="p-4 text-center text-amber-500 font-medium">⚠️ Unreliable</td>
                    <td className="p-4 text-center text-emerald-600 font-extrabold bg-[#E7F256]/10">✅ 100% True Order</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-[#121212]">Zero Password Required</td>
                    <td className="p-4 text-center text-[#555555]">N/A</td>
                    <td className="p-4 text-center text-red-500 font-bold">🚨 DANGEROUS</td>
                    <td className="p-4 text-center text-emerald-600 font-extrabold bg-[#E7F256]/10">✅ 100% Password Free</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-[#121212]">100% Anonymous &amp; Untraceable</td>
                    <td className="p-4 text-center text-red-500 font-bold">❌ Leaves Traces</td>
                    <td className="p-4 text-center text-amber-500 font-medium">⚠️ Risky</td>
                    <td className="p-4 text-center text-emerald-600 font-extrabold bg-[#E7F256]/10">✅ Zero Alert Left</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-[#121212]">Works Right In Browser</td>
                    <td className="p-4 text-center text-emerald-600">✅ Yes</td>
                    <td className="p-4 text-center text-red-500 font-bold">❌ APK Download Needed</td>
                    <td className="p-4 text-center text-emerald-600 font-extrabold bg-[#E7F256]/10">✅ Instant Web Access</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-[#121212]">Change Tracking Alerts</td>
                    <td className="p-4 text-center text-red-500 font-bold">❌ No</td>
                    <td className="p-4 text-center text-red-500 font-bold">❌ No</td>
                    <td className="p-4 text-center text-emerald-600 font-extrabold bg-[#E7F256]/10">✅ Automatic Alerts</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Ca$hvertising Upgrade 3: Real Life Use Cases & Scenarios ── */}
      <section id="use-cases" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#F9F9F7] border-b border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <Badge variant="mono" size="sm" className="mb-3">
              PRACTICAL USE CASES
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              When do people use CheckFollows?
            </h2>
            <p className="mt-3 text-[#555555] font-medium">
              Tailored for privacy, curiosity, and competitive insight.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card hoverable className="bg-[#FFFFFF]">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center mb-3 text-pink-600">
                <Heart className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-1">Dating &amp; Relationships</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Spot new social connections, late-night follows, or unexpected account changes early &ndash; with total privacy.
              </p>
            </Card>

            <Card hoverable className="bg-[#FFFFFF]">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3 text-purple-600">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-1">Exes &amp; Crushes</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Satisfy your curiosity safely. Zero risk of accidentally liking a 3-year-old post or appearing in view logs.
              </p>
            </Card>

            <Card hoverable className="bg-[#FFFFFF]">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3 text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-1">Influencers &amp; Creators</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Discover new brand partnerships, talent agency connections, and influencer growth patterns before anyone else.
              </p>
            </Card>

            <Card hoverable className="bg-[#FFFFFF]">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3 text-emerald-600">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#121212] mb-1">Competitor Intelligence</h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Monitor strategic networking moves made by rival business founders, recruiters, or market competitors.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Interactive Demo Section ── */}
      {searchState.status === "idle" && showDemo && (
        <section className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-lg mx-auto text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#555555] uppercase tracking-widest">
                  Live Preview Mode
                </span>
                <Badge variant="lime" size="sm">Demo Data</Badge>
              </div>

              {/* Demo Profile Header */}
              <Card variant="highlight" className="mb-4">
                <div className="flex items-center gap-4">
                  <Avatar username="johndoe" size="lg" limeHalo />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-lg text-[#121212]">John Doe</h3>
                    <p className="text-xs text-[#555555]">@johndoe</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#555555]">
                      <span><strong className="text-[#121212]">847</strong> following</span>
                      <span><strong className="text-[#121212]">12.3K</strong> followers</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Demo Tab Navigation */}
              <div className="mb-4">
                <Tabs
                  fullWidth
                  activeTab={demoTab}
                  onChange={(id) => setDemoTab(id as "following" | "followers")}
                  tabs={[
                    { id: "following", label: "Recent Following", badge: DEMO_FOLLOWING.length },
                    { id: "followers", label: "Recent Followers", badge: DEMO_FOLLOWERS.length },
                  ]}
                />
              </div>

              {/* Demo Follow Cards */}
              <Card padding="none" className="overflow-hidden bg-[#FFFFFF]">
                <div className="p-2 space-y-1">
                  {demoList.slice(0, 3).map((entry) => (
                    <FollowCard
                      key={entry.id}
                      entry={entry}
                      label={demoTab === "following" ? "Followed" : "Follows them"}
                    />
                  ))}
                </div>

                <div className="relative">
                  <div className="p-2 space-y-1">
                    {demoList.slice(3, 7).map((_, i) => (
                      <BlurredFollowCard key={i} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF]/95 to-transparent pt-16 pb-8 px-4 text-center">
                    <Badge variant="lime" dot pulse className="mb-2">
                      <Lock className="w-3 h-3 mr-1" />
                      {demoList.length - 3}+ accounts hidden
                    </Badge>
                    <p className="text-xs text-[#555555] mb-4 max-w-xs font-medium">
                      Unlock full chronological list and automatic change alerts.
                    </p>
                    <Button
                      variant="primary"
                      leftIcon={<Eye className="w-4 h-4" />}
                      onClick={() => {
                        inputRef.current?.focus();
                        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      Unlock for $12.99/week
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Ca$hvertising Upgrade 4: 5-Tier Social Proof Engine with Real Avatars ── */}
      <section id="testimonials" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#FFFFFF] border-y border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <Badge variant="mono" size="sm" className="mb-3">
              VERIFIED USER REVIEWS
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              Trusted by 50,000+ anonymous searchers
            </h2>
            <p className="mt-3 text-[#555555] font-medium">
              Real feedback from people who wanted the truth without risking their accounts.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((item, idx) => (
              <Card key={idx} hoverable className="bg-[#FFFFFF] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-3 text-amber-400">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current text-[#E7F256]" />
                    ))}
                  </div>
                  <p className="text-xs text-[#121212] leading-relaxed font-medium mb-4 italic">
                    &quot;{item.quote}&quot;
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-[#E2E2DC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#E2E2DC]"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-[#121212]">{item.name}</h4>
                    <span className="text-[10px] text-[#555555] font-mono">{item.role}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stat Metrics Banner ── */}
      <section className="py-16 px-4 sm:px-6 bg-[#F9F9F7] border-b border-[#E2E2DC]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Profile Access" value="Public" subtext="Public profiles only" highlighted />
            <StatCard label="Instagram Login" value="Zero" change="100% Safe" changeType="positive" />
            <StatCard label="Privacy Rating" value="100%" subtext="Untraceable search" />
            <StatCard label="Billing" value="$12.99" change="Cancel Anytime" changeType="neutral" />
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <Badge variant="mono" size="sm" className="mb-3">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121212] tracking-tight">
              Frequently asked questions
            </h2>
          </motion.div>

          <Card variant="default">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                title={faq.q}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {faq.a}
              </AccordionItem>
            ))}
          </Card>
        </div>
      </section>

      {/* ── Call To Action Banner with Anxiety Reducers ── */}
      <section className="py-20 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC] relative overflow-hidden">
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#121212] tracking-tight mb-4">
            Ready to see who they recently followed?
          </h2>
          <p className="text-[#555555] mb-8 text-base sm:text-lg max-w-md mx-auto font-medium">
            Enter an Instagram handle above to start your private inspection now.
          </p>
          <div className="flex flex-col items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              leftIcon={<Search className="w-5 h-5" />}
              onClick={() => {
                focusInput();
              }}
            >
              Inspect an Account Anonymously
            </Button>
            <span className="text-xs text-[#777777] font-semibold mt-2">
              🔒 100% Private &bull; ⚡ Zero IG Login &bull; 💳 1-Click Cancel Anytime
            </span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 sm:px-6 bg-[#FFFFFF] border-t border-[#E2E2DC]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[#121212]">
            <div className="w-6 h-6 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
              <Zap className="w-3.5 h-3.5 fill-current text-[#E7F256]" />
            </div>
            <span>CheckFollows</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-[#777777]">
            <span>© 2026 CheckFollows</span>
            <span>·</span>
            <a href="#" className="hover:text-[#121212] transition-colors">
              Privacy Policy
            </a>
            <span>·</span>
            <a href="#" className="hover:text-[#121212] transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>

      {/* ── Sticky Mobile Search Bar ── */}
      <AnimatePresence>
        {showStickySearch && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#FFFFFF] border-t border-[#E2E2DC] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] sm:hidden"
          >
            <div className="flex gap-2 max-w-lg mx-auto">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter Instagram handle..."
                  leftIcon={<span className="text-[#121212] font-bold">@</span>}
                  className="border-[#E2E2DC] bg-[#F9F9F7] py-3 text-sm"
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleSearch}
                isLoading={searchState.status === "loading"}
                disabled={!searchInput.trim()}
                pill={false}
                className="font-bold"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
