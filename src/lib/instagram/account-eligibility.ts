export const PRIVATE_ACCOUNT_CODE = "private_account";

export const PRIVATE_ACCOUNT_MESSAGE =
  "This Instagram account is private. Privacy law and Instagram’s terms restrict access to non-public profiles, so CheckFollows cannot monitor it. No scan was started and no credits were used.";

export type AutomatedFollowingDecision =
  | "stop_private"
  | "skip_unchanged"
  | "run_full_scan";

export function decideAutomatedFollowingAction(args: {
  isPrivate: boolean;
  hasBaseline: boolean;
  storedFollowingCount: number;
  observedFollowingCount: number;
}): AutomatedFollowingDecision {
  if (args.isPrivate) return "stop_private";
  if (
    args.hasBaseline &&
    args.storedFollowingCount === args.observedFollowingCount
  ) {
    return "skip_unchanged";
  }
  return "run_full_scan";
}
