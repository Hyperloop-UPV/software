import { readFileSync } from "node:fs";

export const REPOSITORY = "Hyperloop-UPV/software";

/** Build-time snapshot only. Opening About never accesses GitHub or a user cache. */
export function getAboutCredits() {
  const data = JSON.parse(
    readFileSync(new URL("./credits.snapshot.json", import.meta.url), "utf8"),
  );
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
