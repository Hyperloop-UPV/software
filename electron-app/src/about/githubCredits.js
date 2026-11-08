import { readFileSync } from "node:fs";

export const REPOSITORY = "Hyperloop-UPV/software";

const SNAPSHOT = new URL("./credits.snapshot.json", import.meta.url);

/** Build-time snapshot only. Opening About never accesses GitHub or a user cache. */
export function getAboutCredits({ snapshotPath = SNAPSHOT } = {}) {
  let raw;
  try {
    raw = readFileSync(snapshotPath, "utf8");
  } catch {
    // Generated at build time and not committed, so it is absent until
    // something builds. About opens with an empty list rather than throwing.
    return { fetchedAt: null, contributors: [] };
  }
  const data = JSON.parse(raw);
  if (data.counting !== "non-merge") {
    throw new Error("About credits must be generated without merge commits");
  }
  return {
    fetchedAt: data.fetchedAt,
    contributors: data.contributors
      .filter((person) => person.type !== "Bot")
      .sort(
        (a, b) =>
          b.contributions - a.contributions || a.name.localeCompare(b.name),
      ),
  };
}
