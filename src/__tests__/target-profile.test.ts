import { describe, expect, it } from "vitest";
import { ownerIdentityFromScan } from "../lib/target-profile";

describe("owner identity from a following scan", () => {
  it("uses the owner's profile, not the first followee", () => {
    const identity = ownerIdentityFromScan({
      username: "bhavyekhetan",
      ownerProfile: {
        userId: "7192655062",
        fullName: "Bhavye",
        avatarUrl: "https://example.com/me.jpg",
        isPrivate: false,
        isVerified: false,
        followerCount: 1080,
        followingCount: 608,
      },
      followingCount: 608,
    });

    expect(identity).toMatchObject({
      userId: "7192655062",
      username: "bhavyekhetan",
      fullName: "Bhavye",
      isVerified: false,
      followerCount: 1080,
      followingCount: 608,
    });
  });

  it("does not invent a verified brand identity when the owner profile is missing", () => {
    const identity = ownerIdentityFromScan({
      username: "bhavyekhetan",
      ownerProfile: null,
      followingCount: 608,
    });

    expect(identity.fullName).toBeNull();
    expect(identity.avatarUrl).toBeNull();
    expect(identity.isVerified).toBe(false);
    expect(identity.userId).toBe("ig_bhavyekhetan");
  });
});
