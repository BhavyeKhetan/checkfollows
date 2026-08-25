/**
 * Tests for private scan diff engine (src/lib/private-scan/diff.ts).
 *
 * Covers:
 *   - Baseline (empty previous → all new members added)
 *   - No changes (identical snapshots → zero events)
 *   - Additions (members in current but not previous)
 *   - Removals (members in previous but not current)
 *   - Mixed additions + removals
 *   - Username changes with same ID (no event)
 *   - Empty current (all removals)
 *   - Set hash determinism
 *   - Follower vs following event types
 */

import { describe, it, expect } from "vitest";
import {
  diffSnapshots,
  type DiffMember,
} from "@/lib/private-scan/diff";

function member(
  instagramId: string,
  overrides: Partial<DiffMember> = {}
): DiffMember {
  return {
    instagramId,
    username: overrides.username ?? `user_${instagramId}`,
    fullName: overrides.fullName ?? null,
    isVerified: overrides.isVerified ?? false,
    avatarUrl: overrides.avatarUrl ?? null,
  };
}

function members(...ids: string[]): DiffMember[] {
  return ids.map((id) => member(id));
}

describe("diffSnapshots", () => {
  describe("Baseline (previous empty)", () => {
    it("reports all current members as NEW_FOLLOWING for following type", () => {
      const result = diffSnapshots(
        [],
        members("A", "B", "C"),
        "following",
        "snap-curr",
        null
      );

      expect(result.added).toHaveLength(3);
      expect(result.added.every((e) => e.eventType === "NEW_FOLLOWING")).toBe(
        true
      );
      expect(result.removed).toHaveLength(0);
      expect(result.previousCount).toBe(0);
      expect(result.currentCount).toBe(3);
    });

    it("reports all current members as NEW_FOLLOWER for followers type", () => {
      const result = diffSnapshots(
        [],
        members("A", "B"),
        "followers",
        "snap-curr",
        null
      );

      expect(result.added).toHaveLength(2);
      expect(result.added.every((e) => e.eventType === "NEW_FOLLOWER")).toBe(
        true
      );
      expect(result.removed).toHaveLength(0);
    });
  });

  describe("No changes", () => {
    it("produces zero events when snapshots are identical", () => {
      const result = diffSnapshots(
        members("A", "B", "C"),
        members("A", "B", "C"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(0);
    });

    it("produces zero events when snapshots are identical (different order)", () => {
      const result = diffSnapshots(
        members("C", "A", "B"),
        members("B", "A", "C"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe("Additions", () => {
    it("detects a single new following", () => {
      const result = diffSnapshots(
        members("A", "B"),
        members("A", "B", "C"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(1);
      expect(result.added[0]).toMatchObject({
        eventType: "NEW_FOLLOWING",
        instagramId: "C",
      });
      expect(result.removed).toHaveLength(0);
    });

    it("detects multiple new follows", () => {
      const result = diffSnapshots(
        members("A"),
        members("A", "B", "C", "D"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(3);
      expect(result.added.map((e) => e.instagramId).sort()).toEqual([
        "B",
        "C",
        "D",
      ]);
    });
  });

  describe("Removals", () => {
    it("detects a single stopped following", () => {
      const result = diffSnapshots(
        members("A", "B", "C"),
        members("A", "C"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toMatchObject({
        eventType: "STOPPED_FOLLOWING",
        instagramId: "B",
      });
      expect(result.added).toHaveLength(0);
    });

    it("detects multiple stopped following", () => {
      const result = diffSnapshots(
        members("A", "B", "C", "D"),
        members("A"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.removed).toHaveLength(3);
      expect(result.removed.map((e) => e.instagramId).sort()).toEqual([
        "B",
        "C",
        "D",
      ]);
    });

    it("correctly maps LOST_FOLLOWER for followers type", () => {
      const result = diffSnapshots(
        members("X", "Y", "Z"),
        members("X"),
        "followers",
        "snap-curr",
        "snap-prev"
      );

      expect(result.removed).toHaveLength(2);
      expect(result.removed.every((e) => e.eventType === "LOST_FOLLOWER")).toBe(
        true
      );
    });
  });

  describe("Mixed changes", () => {
    it("detects both adds and removes in one scan", () => {
      const result = diffSnapshots(
        members("A", "B", "C"),
        members("B", "D", "E"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(2); // D, E
      expect(result.removed).toHaveLength(2); // A, C
      expect(result.addedCount).toBe(2);
      expect(result.removedCount).toBe(2);
    });
  });

  describe("Username changes", () => {
    it("does NOT emit events for username change with same ID", () => {
      const prev = [member("123", { username: "alice_old" })];
      const curr = [member("123", { username: "alice_new" })];

      const result = diffSnapshots(
        prev,
        curr,
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it("DOES emit events when ID changes (even if username matches)", () => {
      const prev = [member("id-old", { username: "same_handle" })];
      const curr = [member("id-new", { username: "same_handle" })];

      const result = diffSnapshots(
        prev,
        curr,
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("handles empty current (all removed)", () => {
      const result = diffSnapshots(
        members("A", "B", "C"),
        [],
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(3);
    });

    it("handles both empty", () => {
      const result = diffSnapshots(
        [],
        [],
        "following",
        "snap-curr",
        null
      );

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.previousCount).toBe(0);
      expect(result.currentCount).toBe(0);
    });

    it("preserves member metadata in events", () => {
      const prev = [member("A", { fullName: "Old Name" })];
      const curr = [member("A"), member("B", { fullName: "Bob", isVerified: true, avatarUrl: "https://example.com/b.jpg" })];

      const result = diffSnapshots(
        prev,
        curr,
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.added).toHaveLength(1);
      expect(result.added[0]).toMatchObject({
        eventType: "NEW_FOLLOWING",
        instagramId: "B",
        fullName: "Bob",
        isVerified: true,
        avatarUrl: "https://example.com/b.jpg",
      });
    });
  });

  describe("Set hash", () => {
    it("produces consistent hash for same members regardless of order", () => {
      const a = diffSnapshots(
        [],
        members("C", "A", "B"),
        "following",
        "snap-curr",
        null
      );

      const b = diffSnapshots(
        [],
        members("A", "B", "C"),
        "following",
        "snap-curr",
        null
      );

      expect(a.setHash).toBe(b.setHash);
      expect(a.setHash).toHaveLength(64); // SHA-256 hex
    });

    it("produces different hashes for different member sets", () => {
      const a = diffSnapshots([], members("A", "B"), "following", "snap-curr", null);
      const b = diffSnapshots([], members("A", "C"), "following", "snap-curr", null);

      expect(a.setHash).not.toBe(b.setHash);
    });
  });

  describe("Count tracking", () => {
    it("accurately tracks previous and current counts", () => {
      const result = diffSnapshots(
        members("A", "B", "C", "D", "E"),
        members("B", "D", "F"),
        "following",
        "snap-curr",
        "snap-prev"
      );

      expect(result.previousCount).toBe(5);
      expect(result.currentCount).toBe(3);
      expect(result.addedCount).toBe(1); // F
      expect(result.removedCount).toBe(3); // A, C, E
    });
  });
});