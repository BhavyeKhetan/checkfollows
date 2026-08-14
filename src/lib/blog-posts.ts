export type BlogSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "why-instagram-scrambles-following-list",
    title: "Why Instagram scrambles the following list (and how to see the real order)",
    description:
      "Instagram doesn't show you who someone followed most recently. Here's why the list is scrambled — and how to see the true chronological order.",
    date: "2026-08-04",
    readTime: "4 min read",
    category: "Guides",
    sections: [
      {
        paragraphs: [
          "Open any Instagram profile, tap 'Following,' and you'd assume the accounts at the top are the ones they followed most recently. That assumption is wrong — and it's exactly what Instagram wants you to think.",
          "The native following list is intentionally scrambled, and the ordering you see has almost nothing to do with recency. Here's what's actually going on.",
        ],
      },
      {
        heading: "How Instagram really sorts the list",
        paragraphs: [
          "When you view someone's following list, Instagram doesn't sort by the date each account was followed. Instead, it applies its own ranking: accounts you have mutual connections with, accounts you're likely to engage with, and accounts Instagram thinks are relevant to you all get pushed toward the top.",
          "The person's newest follow could be sitting twenty rows down, hidden behind a wall of mutuals and suggestions. Unless you know exactly what you're looking for, you'll miss it.",
        ],
      },
      {
        heading: "Why this matters",
        paragraphs: [
          "The order of a following list is a signal. The most recent follows tell you who someone is connecting with right now — new friends, new interests, new relationships, new business contacts. When Instagram scrambles that signal, you lose the one piece of information that actually matters.",
        ],
        bullets: [
          "Newest follows are buried, not surfaced",
          "Mutual connections are prioritized over recency",
          "You can't tell a follow from today vs. a follow from last year",
          "Unfollows are completely invisible",
        ],
      },
      {
        heading: "How to see the real order",
        paragraphs: [
          "The fix is to read the underlying data directly rather than Instagram's ranked view. Tools like CheckFollows pull the public following list and reconstruct the true chronological order, putting the most recent follows at the top.",
          "It works entirely on public data — no login, no password, and the account owner is never notified. Enter a public username and you get the real sequence in seconds.",
        ],
        bullets: [
          "True chronological order — newest first",
          "New follows and unfollows clearly marked",
          "Every-other-day monitoring with change alerts",
          "A permanent timeline you can revisit",
        ],
      },
      {
        heading: "The bottom line",
        paragraphs: [
          "Instagram scrambles the following list because its algorithm is optimized for engagement, not for truth. If you want to know who someone actually followed — and when — you need to look past the ranked view. CheckFollows shows you the real order, every time.",
        ],
      },
    ],
  },
  {
    slug: "how-to-see-who-unfollowed-you",
    title: "How to see who unfollowed you on Instagram (without sketchy apps)",
    description:
      "Instagram never tells you when someone unfollows. Here's how to find out safely — without handing your password to a scam app.",
    date: "2026-08-06",
    readTime: "5 min read",
    category: "Guides",
    sections: [
      {
        paragraphs: [
          "Someone stopped following you. Your follower count dropped, but Instagram won't tell you who. That's by design — Instagram hides unfollows to keep the platform feeling frictionless.",
          "So how do you find out? The wrong way is to download a third-party app that asks for your username and password. Here's the safe way.",
        ],
      },
      {
        heading: "The dangerous way (don't do this)",
        paragraphs: [
          "Search 'who unfollowed me' and you'll find a wall of apps promising instant answers — most of them require you to log in with your Instagram credentials. That's the red flag.",
        ],
        bullets: [
          "They store your password on their servers",
          "They can get your account flagged or banned",
          "They often spam your followers with fake engagement",
          "Your account can be hijacked or locked out",
        ],
      },
      {
        heading: "The safe way",
        paragraphs: [
          "You don't need your password to see who unfollowed you. Your follower list is public data, and the right tool can record it over time and detect changes without ever touching your credentials.",
          "CheckFollows works exactly this way: it snapshots your public follower list, re-checks it on a schedule, and shows you exactly who disappeared — with dates and a full history.",
        ],
        bullets: [
          "No Instagram login or password required",
          "Reads only public data",
          "Every-other-day automatic re-checks",
          "Confirmed unfollows with timestamps",
          "A permanent record of everyone who left",
        ],
      },
      {
        heading: "Why unfollows aren't always what they seem",
        paragraphs: [
          "A word of caution: Instagram sometimes returns inconsistent results, and a single missing name doesn't always mean someone actually unfollowed you. Good tools confirm a removal across multiple checks before reporting it, so you aren't alarmed by a false positive.",
        ],
      },
      {
        heading: "The bottom line",
        paragraphs: [
          "You can absolutely find out who unfollowed you — just don't hand over your password to do it. Use a public-data tool that respects your privacy, and you'll get the truth without the risk.",
        ],
      },
    ],
  },
  {
    slug: "instagram-following-tracker-buyers-guide",
    title: "Instagram following tracker: what to look for before you pay",
    description:
      "Not all following trackers are built the same. Here's what actually matters — monitoring frequency, change detection, and privacy — before you subscribe.",
    date: "2026-08-09",
    readTime: "6 min read",
    category: "Buyer's guide",
    sections: [
      {
        paragraphs: [
          "If you're searching for an Instagram following tracker, you've already realized that checking someone's list manually every day is unsustainable. The question is: which tracker is worth paying for?",
          "Most trackers look identical on the surface. The differences are in the details — and those details determine whether you'll actually catch changes or just waste money on stale data.",
        ],
      },
      {
        heading: "1. How often does it actually re-scan?",
        paragraphs: [
          "A tracker that only updates when you remember to click 'scan again' isn't a tracker — it's a manual tool with extra steps. Real monitoring happens automatically on a schedule.",
          "Look for a default cadence of roughly 24 hours. Anything less frequent and you'll routinely miss the moment a new follow or unfollow happens.",
        ],
      },
      {
        heading: "2. Does it detect both follows and unfollows?",
        paragraphs: [
          "Some tools only show you the current list — no history, no change detection. That's half a product. You want new-follow detection and confirmed unfollow detection, so you can see both sides of every change.",
        ],
      },
      {
        heading: "3. Does it protect against false alarms?",
        paragraphs: [
          "Instagram is inconsistent. A single partial scrape can make it look like someone unfollowed hundreds of accounts when they didn't. A trustworthy tracker validates its data and confirms removals before reporting them, rather than alarming you with garbage.",
        ],
        bullets: [
          "Suspicious partial results are flagged, not trusted",
          "Removals are confirmed across consecutive scans",
          "Failed scans never overwrite good data",
          "The last known-good snapshot is always preserved",
        ],
      },
      {
        heading: "4. Is it private and password-free?",
        paragraphs: [
          "Never use a tracker that requires your Instagram password. The right tool works on public data only, keeps you anonymous, and never notifies the account you're watching.",
        ],
      },
      {
        heading: "5. Does history accumulate?",
        paragraphs: [
          "The real value of a tracker compounds over time. Every day of monitoring adds to a timeline that becomes more valuable the longer you keep it. That's what makes a subscription worth keeping — and what makes cancellation feel like losing something.",
          "CheckFollows checks every box: every-other-day automatic monitoring, dual follow/unfollow detection, confirmed change reporting, password-free privacy, and a permanent accumulating history. Start tracking today and see the difference for yourself.",
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
