"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/mixpanel";

/**
 * Fires one `blog_post_viewed` event per post mount. The content-intelligence
 * pipeline pulls these back through Mixpanel's Export API to score blog
 * inventory, so this is the single source of blog engagement truth.
 */
export function BlogViewTracker({
  slug,
  title,
  category,
}: {
  slug: string;
  title: string;
  category: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("blog_post_viewed", { slug, title, category, source: "blog" });
  }, [slug, title, category]);

  return null;
}
