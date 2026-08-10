export interface InstagramProfile {
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  isPrivate: boolean;
  isVerified: boolean;
  biography: string | null;
  externalUrl: string | null;
}

export interface InstagramAccount {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isVerified: boolean;
}

export interface FollowEntry {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
}

export interface SearchState {
  status: "idle" | "loading" | "profile" | "preview" | "full" | "private" | "not_found" | "error";
  profile: InstagramProfile | null;
  recentFollowing: FollowEntry[] | null;
  recentFollowers: FollowEntry[] | null;
  error: string | null;
}

export interface ApiProfileResponse {
  success: boolean;
  profile?: InstagramProfile;
  detectedAt?: string;
  error?: string;
  isPrivate?: boolean;
  notFound?: boolean;
}

export interface ApiFollowsResponse {
  success: boolean;
  recentFollowing?: FollowEntry[];
  recentFollowers?: FollowEntry[];
  detectedAt?: string;
  error?: string;
}
