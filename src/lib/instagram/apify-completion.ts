import type { InstagramUserEntry } from "./provider";

export interface ApifyCompletionResult {
  username?: string;
  listType?: string;
  count?: number;
  complete?: boolean;
  status?: string;
  incompleteReason?: string | null;
  integrityFailure?: boolean;
}

export interface ApifyCompletionOutput {
  results?: ApifyCompletionResult[];
  partial?: boolean;
  complete?: boolean;
  status?: string;
  incompleteReasons?: string[];
}

interface FullScanValidationInput {
  output: ApifyCompletionOutput | null;
  entries: Map<string, InstagramUserEntry[]>;
  usernames: string[];
  dataToScrape: "Followings" | "Followers";
}

export function validateFullScanCompletion({
  output,
  entries,
  usernames,
  dataToScrape,
}: FullScanValidationInput): string | null {
  if (!output) return "Actor did not publish a completion manifest";

  if (
    output.complete !== true ||
    output.partial === true ||
    output.status !== "complete"
  ) {
    const reasons = output.incompleteReasons?.filter(Boolean).join(", ");
    return reasons
      ? `Actor marked the scan incomplete: ${reasons}`
      : `Actor marked the scan ${output.status || "incomplete"}`;
  }

  if (!Array.isArray(output.results)) {
    return "Actor completion manifest is missing per-account results";
  }

  const expectedListType =
    dataToScrape === "Followings" ? "following" : "followers";

  for (const username of usernames) {
    const result = output.results.find(
      (candidate) =>
        candidate.username?.toLowerCase() === username &&
        candidate.listType?.toLowerCase() === expectedListType
    );

    if (!result) {
      return `Actor completion manifest is missing @${username}`;
    }

    if (
      result.complete !== true ||
      result.status !== "complete" ||
      result.integrityFailure === true ||
      result.incompleteReason
    ) {
      return result.incompleteReason
        ? `Actor marked @${username} incomplete: ${result.incompleteReason}`
        : `Actor marked @${username} incomplete`;
    }

    const accountEntries = entries.get(username) || [];
    if (result.count !== accountEntries.length) {
      return `Actor count mismatch for @${username}: manifest=${result.count ?? "missing"}, dataset=${accountEntries.length}`;
    }

    const uniqueIds = new Set(accountEntries.map((entry) => entry.userId));
    if (uniqueIds.size !== accountEntries.length) {
      return `Actor dataset contains duplicate accounts for @${username}`;
    }

    if (accountEntries.some((entry) => !entry.userId || !entry.username)) {
      return `Actor dataset contains invalid accounts for @${username}`;
    }
  }

  return null;
}
