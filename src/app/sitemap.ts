import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-posts";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://checkfollows.vercel.app";

const STATIC_ROUTES = [
  { path: "", priority: 1.0 },
  { path: "/pricing", priority: 0.9 },
  { path: "/see-who-someone-follows", priority: 0.8 },
  { path: "/who-unfollowed-me", priority: 0.8 },
  { path: "/see-who-someone-unfollowed", priority: 0.8 },
  { path: "/instagram-following-tracker", priority: 0.8 },
  { path: "/instagram-follower-tracker", priority: 0.8 },
  { path: "/anonymous-instagram-viewer", priority: 0.8 },
  { path: "/blog", priority: 0.7 },
  { path: "/about", priority: 0.5 },
  { path: "/contact", priority: 0.5 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/refund", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: r.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
