import { describe, expect, it } from "vitest";

import { validateFullScanCompletion } from "@/lib/instagram/apify-completion";
import type { InstagramUserEntry } from "@/lib/instagram/provider";

function entry(userId: string): InstagramUserEntry {
  return {
    userId,
    username: `user_${userId}`,
    fullName: null,
    avatarUrl: null,
    isPrivate: false,
    isVerified: false,
  };
}

function validInput() {
  return {
    output: {
      complete: true,
      partial: false,
      status: "complete",
      incompleteReasons: [] as string[],
      results: [
        {
          username: "bhavyekhetan",
          listType: "following",
          count: 3,
          complete: true,
          status: "complete",
          incompleteReason: null as string | null,
          integrityFailure: false,
        },
      ],
    },
    entries: new Map([["bhavyekhetan", [entry("1"), entry("2"), entry("3")]]]),
    usernames: ["bhavyekhetan"],
    dataToScrape: "Followings" as const,
  };
}

describe("Apify full-scan completion validation", () => {
  it("accepts a complete manifest matching a unique dataset", () => {
    expect(validateFullScanCompletion(validInput())).toBeNull();
  });

  it("rejects a missing completion manifest", () => {
    expect(
      validateFullScanCompletion({ ...validInput(), output: null })
    ).toMatch(/did not publish/i);
  });

  it("rejects an Actor-declared incomplete scan", () => {
    const input = validInput();
    input.output.complete = false;
    input.output.partial = true;
    input.output.status = "incomplete";
    input.output.incompleteReasons = ["session_changed_during_pagination"];

    expect(validateFullScanCompletion(input)).toMatch(
      /session_changed_during_pagination/
    );
  });

  it("rejects an incomplete per-account result", () => {
    const input = validInput();
    input.output.results[0].complete = false;
    input.output.results[0].status = "incomplete";
    input.output.results[0].incompleteReason = "duplicate_reduced_page";

    expect(validateFullScanCompletion(input)).toMatch(/duplicate_reduced_page/);
  });

  it("rejects a manifest/dataset count mismatch", () => {
    const input = validInput();
    input.output.results[0].count = 605;

    expect(validateFullScanCompletion(input)).toMatch(/count mismatch/i);
  });

  it("rejects duplicate Instagram IDs", () => {
    const input = validInput();
    input.entries.set("bhavyekhetan", [entry("1"), entry("2"), entry("2")]);

    expect(validateFullScanCompletion(input)).toMatch(/duplicate/i);
  });

  it("rejects a missing account result in a batch", () => {
    const input = validInput();
    input.usernames.push("second_account");

    expect(validateFullScanCompletion(input)).toMatch(/second_account/);
  });
});
