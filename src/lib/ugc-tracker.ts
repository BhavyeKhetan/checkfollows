import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CHECKFOLLOWS_UGC_APP_SLUG = "checkfollows";

let client: SupabaseClient | null = null;

export function getUgcTrackerClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.UGC_SUPABASE_URL;
  const serviceRoleKey = process.env.UGC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing UGC Tracker Supabase environment variables");
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function getCheckFollowsUgcAppId(
  supabase: SupabaseClient = getUgcTrackerClient()
): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", CHECKFOLLOWS_UGC_APP_SLUG)
    .eq("is_active", true)
    .single();

  if (error || !data?.id) {
    throw new Error("CheckFollows is not configured in UGC Tracker");
  }
  return data.id as string;
}
