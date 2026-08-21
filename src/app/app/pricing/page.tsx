import { redirect } from "next/navigation";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import AppPricingClient from "./pricing-client";

export const dynamic = "force-dynamic";

export default async function AppPricingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/app/pricing");
  if (await hasActiveSubscription(user.id)) redirect("/dashboard");
  return <AppPricingClient />;
}
