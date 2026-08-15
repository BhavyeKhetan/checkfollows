"use client";

import { useEffect } from "react";
import { initMixpanel, identify } from "@/lib/mixpanel";
import { createClient } from "@/lib/supabase/client";

/**
 * Initializes Mixpanel once on app load and, if a Supabase session already
 * exists, restores identity so returning users' events stay linked to their
 * profile. Mounted once in the root layout.
 */
export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMixpanel();

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user) {
          identify(user.id, { $email: user.email ?? undefined });
        }
      } catch {
        /* non-fatal — analytics must never break the page */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
