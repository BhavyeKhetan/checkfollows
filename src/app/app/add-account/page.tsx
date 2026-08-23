import { redirect } from "next/navigation";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import AddAccountClient from "./add-account-client";

export const dynamic = "force-dynamic";

export default async function AddAccountPage({
  searchParams,
}: PageProps<"/app/add-account">) {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/app/add-account");
  if (!(await hasActiveSubscription(user.id))) redirect("/app/pricing");
  const params = await searchParams;
  return (
    <AddAccountClient
      initialUsername={typeof params.username === "string" ? params.username : ""}
      initialTargetId={typeof params.targetId === "string" ? params.targetId : ""}
      postPurchase={params.postPurchase === "1"}
    />
  );
}
