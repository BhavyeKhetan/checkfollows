import { redirect } from "next/navigation";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import AddAccountClient from "./add-account-client";

export const dynamic = "force-dynamic";

export default async function AddAccountPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/app/add-account");
  if (!(await hasActiveSubscription(user.id))) redirect("/app/pricing");
  return <AddAccountClient />;
}
