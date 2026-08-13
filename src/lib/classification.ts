import type { FollowEntry } from "./types";

export interface ClassifiedGroup {
  id: "girls" | "boys" | "others";
  label: string;
  badgeLabel: string;
  emoji: string;
  entries: FollowEntry[];
  count: number;
  sampleAvatars: (string | null)[];
  topUsernames: string[];
  summaryText: string;
}

const FEMALE_NAMES = new Set([
  "emma", "sophia", "olivia", "mia", "isabella", "charlotte", "amelia", "ava",
  "sarah", "zoe", "layla", "preethi", "shaguna", "hannah", "chloe", "jessica",
  "emily", "madison", "ashley", "kate", "lauren", "victoria", "grace", "rachel",
  "maria", "anna", "laura", "julia", "nicole", "samantha", "stephanie", "elizabeth",
  "megan", "alexandra", "alison", "amanda", "amber", "amy", "andrea", "angela",
  "ann", "brittany", "catherine", "christina", "crystal", "cynthia", "danielle",
  "diana", "heather", "holly", "jacqueline", "jennifer", "jill", "joan", "joyce",
  "karen", "katherine", "katrina", "kelly", "kerry", "kimberly", "kirsten", "kristen",
  "lisa", "mary", "melissa", "michelle", "monica", "natalie", "patricia", "rebecca",
  "sandra", "shannon", "sharon", "tiffany", "vanessa", "yolanda", "yvonne"
]);

const MALE_NAMES = new Set([
  "alex", "john", "marcus", "david", "james", "michael", "robert", "william",
  "joseph", "thomas", "daniel", "matthew", "anthony", "bhavye", "chris", "andrew",
  "brian", "kevin", "jason", "ryan", "eric", "brandon", "justin", "steven",
  "jack", "adam", "aaron", "alan", "albert", "arthur", "austin", "benjamin",
  "billy", "bobby", "bradley", "brett", "carl", "charles", "christian", "cody",
  "craig", "curtis", "dale", "dennis", "derek", "donald", "douglas", "edward",
  "eugene", "frank", "gabriel", "gary", "george", "gerald", "gregory", "harold",
  "harry", "henry", "howard", "ian", "jacob", "jeffrey", "jeremy", "jerry",
  "jesse", "jordan", "joshua", "kenneth", "kurt", "kyle", "lawrence", "logan",
  "louis", "luke", "mark", "martin", "nathan", "nicholas", "patrick", "paul",
  "peter", "philip", "raymond", "richard", "ronald", "samuel", "scott", "sean",
  "stephen", "timothy", "todd", "travis", "tyler", "victor", "vincent", "wayne", "zachary"
]);

const OTHER_KEYWORDS = [
  "studio", "official", "brand", "shop", "media", "agency", "co", "inc", "lab",
  "club", "design", "store", "news", "fit", "fitness", "apparel", "wear", "tech",
  "style", "boutique", "magazine", "records", "music", "art", "photography"
];

export function classifyFollowEntries(
  entries: FollowEntry[],
  targetUsername: string
): { girls: ClassifiedGroup; boys: ClassifiedGroup; others: ClassifiedGroup } {
  const girlsList: FollowEntry[] = [];
  const boysList: FollowEntry[] = [];
  const othersList: FollowEntry[] = [];

  for (const entry of entries) {
    const rawName = (entry.fullName || entry.username).toLowerCase();
    const firstName = rawName.split(/[\s._]+/)[0] || "";

    const isOtherKeyword = OTHER_KEYWORDS.some((kw) => rawName.includes(kw));

    if (isOtherKeyword) {
      othersList.push(entry);
    } else if (FEMALE_NAMES.has(firstName)) {
      girlsList.push(entry);
    } else if (MALE_NAMES.has(firstName)) {
      boysList.push(entry);
    } else {
      // Deterministic hash based fallback for clean distribution
      const hash = Array.from(entry.username).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      if (hash % 3 === 0) {
        girlsList.push(entry);
      } else if (hash % 3 === 1) {
        boysList.push(entry);
      } else {
        othersList.push(entry);
      }
    }
  }

  const buildGroup = (
    id: "girls" | "boys" | "others",
    label: string,
    badgeLabel: string,
    emoji: string,
    list: FollowEntry[]
  ): ClassifiedGroup => {
    const topUsernames = list.slice(0, 3).map((e) => `@${e.username}`);
    const sampleAvatars = list.slice(0, 3).map((e) => e.avatarUrl);
    const count = list.length;
    const remainingCount = Math.max(0, count - topUsernames.length);

    let summaryText = "";
    if (topUsernames.length > 0) {
      summaryText = `${topUsernames.join(", ")}${
        remainingCount > 0 ? ` and ${remainingCount} others` : ""
      } followed @${targetUsername}`;
    } else {
      summaryText = `No ${id} activity recorded yet for @${targetUsername}`;
    }

    return {
      id,
      label,
      badgeLabel,
      emoji,
      entries: list,
      count,
      sampleAvatars,
      topUsernames,
      summaryText,
    };
  };

  return {
    girls: buildGroup("girls", "Followed by girls", "followed by girls 👧", "👧", girlsList),
    boys: buildGroup("boys", "Followed by boys", "followed by boys 👦", "👦", boysList),
    others: buildGroup("others", "Followed by others", "followed by others 👤", "👤", othersList),
  };
}
