"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Clock,
  Shield,
  Users,
  ArrowRight,
  ChevronDown,
  Check,
  Sparkles,
  UserCheck,
  UserPlus,
  History,
  Menu,
  X,
} from "lucide-react";
import type { SearchState, InstagramProfile, FollowEntry } from "@/lib/types";

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

// ─── Components ────────────────────────────────────────────────────

function AvatarPlaceholder({
  username,
  size = "md",
}: {
  username: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-lg" };
  const colors = [
    "bg-emerald-500/20 text-emerald-400",
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-pink-500/20 text-pink-400",
    "bg-amber-500/20 text-amber-400",
    "bg-cyan-500/20 text-cyan-400",
  ];
  const colorIdx = username.charCodeAt(0) % colors.length;

  return (
    <div
      className={`${sizes[size]} rounded-full ${colors[colorIdx]} flex items-center justify-center font-semibold shrink-0`}
    >
      {username[0].toUpperCase()}
    </div>
  );
}

function FollowCard({
  entry,
  label,
}: {
  entry: FollowEntry;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1e] transition-colors cursor-pointer group">
      <AvatarPlaceholder username={entry.username} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate text-[#fafafa]">
            {entry.username}
          </span>
          {entry.isVerified && (
            <span className="text-blue-400 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-xs text-[#a1a1aa] truncate">
          {entry.fullName || entry.username}
        </p>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
}

function BlurredFollowCard() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl relative overflow-hidden">
      <div className="w-10 h-10 rounded-full bg-[#1a1a1e] blur-[6px]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-24 bg-[#1a1a1e] rounded blur-[4px]" />
        <div className="h-2.5 w-16 bg-[#1a1a1e] rounded blur-[4px]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#09090b]/50 to-transparent" />
    </div>
  );
}

// ─── FAQ data ──────────────────────────────────────────────────────

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
    q: "How does CheckFollows know who someone recently followed?",
    a: "We analyze publicly available follower and following data. Instagram's default list is not reliably chronological, so we organize and track changes to show what's new.",
  },
  {
    q: "How much does it cost?",
    a: "CheckFollows is $12.99/week. You can search, preview results, and then subscribe to unlock the full list, followers, and change tracking.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription at any time and your access will continue until the end of your billing period.",
  },
];

// ─── Main Page ─────────────────────────────────────────────────────

export default function Home() {
  const [searchInput, setSearchInput] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
    profile: null,
    recentFollowing: null,
    recentFollowers: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"following" | "followers">("following");
  const [showDemo, setShowDemo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    const username = searchInput.replace(/^@/, "").trim();
    if (!username) return;

    setSearchState({ status: "loading", profile: null, recentFollowing: null, recentFollowers: null, error: null });

    try {
      // First get profile
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

      // Profile found — show preview
      setSearchState((prev) => ({
        ...prev,
        status: "preview",
        profile: profileData.profile,
        error: null,
      }));

      // Fetch follow data
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
    } catch (err) {
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
    // Check for demo timer
    const timer = setTimeout(() => setShowDemo(true), 2000);
    return () => clearTimeout(timer);
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
        className="w-full max-w-lg mx-auto mt-6"
      >
        {/* Profile header */}
        {searchState.profile && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#131316] border border-[#27272a] mb-4">
            <AvatarPlaceholder
              username={searchState.profile.username}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate text-[#fafafa]">
                  {searchState.profile.fullName || searchState.profile.username}
                </h3>
                {searchState.profile.isVerified && (
                  <span className="text-blue-400 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-sm text-[#a1a1aa]">@{searchState.profile.username}</p>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-[#a1a1aa]">
                <span>
                  <strong className="text-[#fafafa]">
                    {searchState.profile.followingCount.toLocaleString()}
                  </strong>{" "}
                  following
                </span>
                <span>
                  <strong className="text-[#fafafa]">
                    {searchState.profile.followerCount.toLocaleString()}
                  </strong>{" "}
                  followers
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#131316] rounded-xl border border-[#27272a] mb-3">
          <button
            onClick={() => setActiveTab("following")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "following"
                ? "bg-[#1a1a1e] text-[#fafafa] shadow-sm"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            Recent Following
          </button>
          <button
            onClick={() => setActiveTab("followers")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "followers"
                ? "bg-[#1a1a1e] text-[#fafafa] shadow-sm"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            Recent Followers
          </button>
        </div>

        {/* Results list */}
        <div className="bg-[#131316] border border-[#27272a] rounded-2xl overflow-hidden">
          {displayList.slice(0, isPaid ? displayList.length : 3).map((entry, i) => (
            <FollowCard
              key={entry.id}
              entry={entry}
              label={
                activeTab === "following" ? "Followed" : "Follows them"
              }
            />
          ))}

          {/* Blurred paywall */}
          {!isPaid && displayList.length > 3 && (
            <div className="relative">
              {displayList.slice(3, 8).map((_, i) => (
                <BlurredFollowCard key={i} />
              ))}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent pt-20 pb-8 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-sm font-semibold text-[#fafafa]">
                    {displayList.length - 3}+ more accounts hidden
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] mb-4 text-center">
                  Unlock to see all {activeTab === "following" ? "recent follows" : "recent followers"} and track changes
                </p>
                <button
                  className="btn-primary text-sm"
                  onClick={() => {
                    // Navigate to Stripe checkout
                    window.location.href = "/api/stripe/checkout";
                  }}
                >
                  <Eye className="w-4 h-4" />
                  Unlock for $12.99/week
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {displayList.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-[#71717a] text-sm">
                No {activeTab === "following" ? "following" : "follower"} data available yet.
              </p>
              <p className="text-[#71717a] text-xs mt-1">
                Check back soon or try another account.
              </p>
            </div>
          )}
        </div>

        {/* Tracking CTA for paid users */}
        {isPaid && (
          <button className="w-full mt-3 py-3 px-4 bg-[#131316] border border-[#27272a] rounded-xl text-sm font-medium text-[#fafafa] hover:bg-[#1a1a1e] transition-colors flex items-center justify-center gap-2">
            <Bell className="w-4 h-4 text-[#22c55e]" />
            Track this account for changes
          </button>
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
              <div className="w-12 h-12 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
              <p className="text-[#a1a1aa] text-sm">Analyzing public data...</p>
              <div className="space-y-2 w-full">
                <div className="h-3 shimmer rounded-lg w-3/4 mx-auto" />
                <div className="h-3 shimmer rounded-lg w-1/2 mx-auto" />
              </div>
            </div>
          </motion.div>
        );

      case "private":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center"
          >
            <EyeOff className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="font-semibold text-[#fafafa] mb-1">Private Account</h3>
            <p className="text-sm text-[#a1a1aa]">
              This account is private. CheckFollows only works with public Instagram accounts.
            </p>
            <button
              onClick={() =>
                setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
              }
              className="mt-4 text-sm text-[#22c55e] hover:underline"
            >
              Try another username
            </button>
          </motion.div>
        );

      case "not_found":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center"
          >
            <Search className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold text-[#fafafa] mb-1">Account Not Found</h3>
            <p className="text-sm text-[#a1a1aa]">
              We couldn't find an Instagram account with that username. Double-check the spelling and try again.
            </p>
            <button
              onClick={() =>
                setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
              }
              className="mt-4 text-sm text-[#22c55e] hover:underline"
            >
              Try again
            </button>
          </motion.div>
        );

      case "error":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center"
          >
            <p className="text-sm text-[#a1a1aa]">{searchState.error}</p>
            <button
              onClick={() =>
                setSearchState({ status: "idle", profile: null, recentFollowing: null, recentFollowers: null, error: null })
              }
              className="mt-3 text-sm text-[#22c55e] hover:underline"
            >
              Try again
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 glass border-b border-[#27272a]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-[#fafafa] hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-[#22c55e] flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-[#09090b]" />
            </div>
            CheckFollows
          </a>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
              How it works
            </a>
            <a href="#features" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
              Features
            </a>
            <a href="#faq" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
              FAQ
            </a>
            <button
              onClick={() => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="btn-primary text-sm py-2 px-4"
            >
              Check their follows
            </button>
          </div>

          {/* Mobile menu */}
          <button
            className="sm:hidden p-2 text-[#a1a1aa] hover:text-[#fafafa]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden border-t border-[#27272a]/50 bg-[#09090b]"
            >
              <div className="px-4 py-3 space-y-3">
                <a
                  href="#how-it-works"
                  className="block text-sm text-[#a1a1aa] hover:text-[#fafafa]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How it works
                </a>
                <a
                  href="#features"
                  className="block text-sm text-[#a1a1aa] hover:text-[#fafafa]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#faq"
                  className="block text-sm text-[#a1a1aa] hover:text-[#fafafa]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </a>
                <button
                  className="btn-primary text-sm w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    inputRef.current?.focus();
                    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Check their follows
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#22c55e]/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="badge badge-green mb-6">
              No Instagram login required
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#fafafa] leading-[1.1] max-w-3xl mx-auto"
          >
            See who they{" "}
            <span className="gradient-text">recently followed</span>
            {" "}on Instagram.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg text-[#a1a1aa] max-w-xl mx-auto leading-relaxed"
          >
            Enter any public Instagram username to see recent follows, recent followers, and changes over time. Private, secure, and no Instagram login needed.
          </motion.p>

          {/* Search input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 max-w-lg mx-auto"
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#71717a] text-lg font-medium">
                  @
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="username"
                  className="input-dark pl-9 text-lg"
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchState.status === "loading" || !searchInput.trim()}
                className="btn-primary text-base px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchState.status === "loading" ? (
                  <div className="w-5 h-5 rounded-full border-2 border-[#09090b] border-t-transparent animate-spin" />
                ) : (
                  <>
                    Check
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-[#71717a]">
              Public accounts only. Your search is private and anonymous.
            </p>
          </motion.div>

          {/* Result section */}
          {renderStatusState()}
          {renderResultSection()}
        </div>
      </section>

      {/* ── Demo Preview (shows after delay) ── */}
      {searchState.status === "idle" && showDemo && (
        <section className="pb-16 sm:pb-24 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-lg mx-auto"
            >
              <p className="text-center text-xs text-[#71717a] mb-4 uppercase tracking-widest">
                Preview
              </p>

              {/* Demo profile header */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#131316] border border-[#27272a] mb-4">
                <AvatarPlaceholder username="johndoe" size="lg" />
                <div>
                  <h3 className="font-semibold text-lg text-[#fafafa]">John Doe</h3>
                  <p className="text-sm text-[#a1a1aa]">@johndoe</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-[#a1a1aa]">
                    <span><strong className="text-[#fafafa]">847</strong> following</span>
                    <span><strong className="text-[#fafafa]">12.3K</strong> followers</span>
                  </div>
                </div>
              </div>

              {/* Demo tabs */}
              <div className="flex gap-1 p-1 bg-[#131316] rounded-xl border border-[#27272a] mb-3">
                <button className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-[#1a1a1e] text-[#fafafa]">
                  Recent Following
                </button>
                <button className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-[#71717a]">
                  Recent Followers
                </button>
              </div>

              {/* Demo results */}
              <div className="bg-[#131316] border border-[#27272a] rounded-2xl overflow-hidden">
                {DEMO_FOLLOWING.slice(0, 3).map((entry) => (
                  <FollowCard key={entry.id} entry={entry} label="Followed" />
                ))}
                <div className="relative">
                  {DEMO_FOLLOWING.slice(3, 7).map((_, i) => (
                    <BlurredFollowCard key={i} />
                  ))}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent pt-20 pb-8 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-[#22c55e]" />
                      <span className="text-sm font-semibold text-[#fafafa]">
                        5+ more accounts hidden
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mb-4 text-center">
                      Unlock to see all recent follows and track changes
                    </p>
                    <button
                      className="btn-primary text-sm"
                      onClick={() => {
                        inputRef.current?.focus();
                        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Unlock for $12.99/week
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0c0c0f]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-[#fafafa]">
              How it works
            </h2>
            <p className="mt-3 text-[#a1a1aa]">
              Three steps to clarity. No Instagram login required.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                title: "Enter a username",
                desc: "Type any public Instagram username you want to check. We support any public account.",
              },
              {
                icon: Sparkles,
                title: "We analyze the data",
                desc: "We scan publicly available follower and following data and organize it chronologically.",
              },
              {
                icon: Eye,
                title: "See the results",
                desc: "View recent follows and followers in a clean, chronological list. Track changes over time.",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card-dark flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-[#22c55e]" />
                </div>
                <h3 className="font-semibold text-[#fafafa] mb-2">{step.title}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-[#fafafa]">
              Everything you need to know
            </h2>
            <p className="mt-3 text-[#a1a1aa]">
              Simple tools to answer the question on your mind.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: UserPlus,
                title: "Recent Follows",
                desc: "See who they recently followed, organized newest-first. No more scrolling through hundreds of accounts manually.",
              },
              {
                icon: UserCheck,
                title: "Recent Followers",
                desc: "See who recently followed them. Understand the full picture of their social activity.",
              },
              {
                icon: Clock,
                title: "Track Changes",
                desc: "Save accounts and get notified when follow activity changes. New follows, unfollows, and new followers.",
              },
              {
                icon: Shield,
                title: "Private & Anonymous",
                desc: "Your searches are never disclosed. No Instagram login required. The person you check will never know.",
              },
              {
                icon: History,
                title: "Activity Timeline",
                desc: "View a chronological timeline of detected changes. See exactly when new connections were made.",
              },
              {
                icon: Bell,
                title: "Change Alerts",
                desc: "Get notified when meaningful follow activity happens. Stay informed without constantly checking.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="card-dark flex gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-[#22c55e]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#fafafa] mb-1">{feature.title}</h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Stats ── */}
      <section className="py-16 px-4 sm:px-6 bg-[#0c0c0f] border-y border-[#27272a]/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "Public", label: "Accounts only" },
              { value: "Zero", label: "Instagram login needed" },
              { value: "100%", label: "Anonymous searches" },
              { value: "Weekly", label: "Cancel anytime" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-xs text-[#71717a] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-[#fafafa]">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card-dark"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="font-medium text-[#fafafa] pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#71717a] shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 text-sm text-[#a1a1aa] leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0c0c0f]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#fafafa] mb-4">
            Ready to stop guessing?
          </h2>
          <p className="text-[#a1a1aa] mb-8">
            Enter a username and see what's really going on.
          </p>
          <button
            onClick={() => {
              inputRef.current?.focus();
              inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="btn-primary text-lg px-8 py-3"
          >
            <Search className="w-5 h-5" />
            Check their follows now
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 sm:px-6 border-t border-[#27272a]/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#71717a]">
            <div className="w-5 h-5 rounded-md bg-[#22c55e] flex items-center justify-center">
              <Search className="w-3 h-3 text-[#09090b]" />
            </div>
            CheckFollows
          </div>
          <div className="flex items-center gap-6 text-xs text-[#71717a]">
            <span>© 2026 CheckFollows</span>
            <span>·</span>
            <a href="#" className="hover:text-[#a1a1aa] transition-colors">
              Privacy
            </a>
            <span>·</span>
            <a href="#" className="hover:text-[#a1a1aa] transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
