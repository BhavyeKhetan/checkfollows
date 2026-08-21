import type { InstagramProfile, InstagramUserEntry } from "@/lib/instagram/provider";

/**
 * Identity for a tracked Instagram account must come from that account's
 * profile. The following list is other people — never copy the first
 * followee's name, avatar, or verified flag onto the owner.
 */
export function ownerIdentityFromScan(args: {
  username: string;
  ownerProfile: Pick<
    InstagramProfile,
    | "userId"
    | "fullName"
    | "avatarUrl"
    | "isPrivate"
    | "isVerified"
    | "followerCount"
    | "followingCount"
  > | null;
  followingCount: number;
}): {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
} {
  const username = args.username.replace(/^@/, "").trim().toLowerCase();
  const owner = args.ownerProfile;
  return {
    userId: owner?.userId || `ig_${username}`,
    username,
    fullName: owner?.fullName ?? null,
    avatarUrl: owner?.avatarUrl ?? null,
    isPrivate: owner?.isPrivate ?? false,
    isVerified: owner?.isVerified ?? false,
    followerCount: owner?.followerCount ?? 0,
    followingCount: args.followingCount,
  };
}

/** Guard for tests and scrapers: a followee must not be treated as the owner. */
export function isSameAccount(
  ownerUsername: string,
  entry: Pick<InstagramUserEntry, "username">
): boolean {
  return (
    ownerUsername.replace(/^@/, "").trim().toLowerCase() ===
    entry.username.replace(/^@/, "").trim().toLowerCase()
  );
}
