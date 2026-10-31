import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPOSITORY = "Hyperloop-UPV/software";
const SNAPSHOT = path.join(ROOT, "src/about/credits.snapshot.json");
const AVATARS = path.join(ROOT, "renderer/about/avatars");

/** Runs during Electron build/packaging, never from the running application. */
export async function generateAboutCredits({
  fetchImpl = globalThis.fetch,
  snapshotPath = SNAPSHOT,
  avatarDirectory = AVATARS,
  token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  now = Date.now,
  warn = console.warn,
} = {}) {
  let previous;
  try {
    previous = JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch {
    /* First build. */
  }
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Hyperloop-UPV-Control-Station",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const authors = new Map();
    const seen = new Set();
    let headSha;
    for (let page = 1; ; page++) {
      const response = await fetchImpl(
        `https://api.github.com/repos/${REPOSITORY}/commits?${headSha ? `sha=${headSha}&` : ""}per_page=100&page=${page}`,
        {
          headers,
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok)
        throw new Error(`GitHub commits: HTTP ${response.status}`);
      const commits = await response.json();
      if (!Array.isArray(commits))
        throw new Error("Invalid GitHub commit response");
      if (page === 1 && commits.length) {
        headSha = commits[0].sha;
        if (!/^[a-f0-9]{40}$/.test(headSha))
          throw new Error("Invalid history head");
        // A second build of the same revision can reuse its already verified counts/photos.
        if (previous?.counting === "non-merge" && previous.headSha === headSha)
          return previous;
      }
      for (const commit of commits) {
        if (
          !/^[a-f0-9]{40}$/.test(commit.sha) ||
          !Array.isArray(commit.parents)
        )
          throw new Error("Invalid GitHub commit");
        if (seen.has(commit.sha)) continue;
        seen.add(commit.sha);
        // Check ancestry, not the message: ordinary commits can be named "merge".
        // Root commits (zero parents) and empty non-merge commits still count.
        if (commit.parents.length > 1) continue;
        const person = commit.author || {};
        if (person.type === "Bot") continue;
        const login = typeof person.login === "string" ? person.login : null;
        if (
          login &&
          (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(login) ||
            !Number.isSafeInteger(person.id))
        )
          throw new Error("Invalid GitHub contributor identity");
        // Emails are used only as transient identity keys, never written to the snapshot.
        const name = login || commit.commit?.author?.name || "Unlinked author";
        const key = login
          ? `user:${person.id}`
          : `anonymous:${commit.commit?.author?.email || name}`;
        if (authors.has(key)) {
          authors.get(key).contributions++;
          continue;
        }
        authors.set(key, {
          id: login ? String(person.id) : `anonymous-${authors.size}`,
          login,
          name,
          contributions: 1,
          avatarUrl: null,
          type: login ? "User" : "Anonymous",
        });
      }
      if (commits.length < 100) break;
      if (page === 1000) throw new Error("Too many commit pages");
    }
    const contributors = [...authors.values()];
    if (!contributors.length)
      throw new Error("GitHub returned no contributors");
    contributors.sort(
      (a, b) =>
        b.contributions - a.contributions || a.name.localeCompare(b.name),
    );
    await mkdir(avatarDirectory, { recursive: true });
    // Four downloads at a time, without sending the GitHub API token to the avatar host.
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (cursor < contributors.length) {
          const person = contributors[cursor++];
          if (!person.login) continue;
          try {
            const response = await fetchImpl(
              `https://avatars.githubusercontent.com/u/${person.id}?s=96`,
              { signal: AbortSignal.timeout(10_000) },
            );
            if (!response.ok) throw new Error("Avatar download failed");
            const type = response.headers.get("content-type")?.split(";")[0];
            const extension = {
              "image/png": "png",
              "image/jpeg": "jpg",
              "image/webp": "webp",
            }[type];
            if (!extension) throw new Error("Unsupported avatar image");
            const image = Buffer.from(await response.arrayBuffer());
            if (!image.length || image.length > 256_000)
              throw new Error("Invalid avatar size");
            const filename = `${person.id}.${extension}`;
            await writeFile(path.join(avatarDirectory, filename), image);
            person.avatarUrl = `./avatars/${filename}`;
          } catch {
            const saved = previous?.contributors?.find(
              (item) => item.id === person.id,
            )?.avatarUrl;
            if (/^\.\/avatars\/\d+\.(png|jpg|webp)$/.test(saved)) {
              try {
                await readFile(
                  path.join(avatarDirectory, path.basename(saved)),
                );
                person.avatarUrl = saved;
              } catch {
                /* Initials are the offline fallback. */
              }
            }
            warn(
              `About: could not update the avatar for ${person.name}; keeping the local fallback.`,
            );
          }
        }
      }),
    );
    const snapshot = {
      schemaVersion: 3,
      repository: REPOSITORY,
      counting: "non-merge",
      headSha,
      fetchedAt: new Date(now()).toISOString(),
      contributors,
    };
    const temporary = `${snapshotPath}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );
    await rename(temporary, snapshotPath);
    return snapshot;
  } catch (error) {
    // Offline builds retain the complete bundled credits instead of generating a partial list.
    if (!previous?.contributors?.length || previous.counting !== "non-merge")
      throw error;
    warn(`About: ${error.message}. Using the bundled contributor snapshot.`);
    return previous;
  }
}

// electron-builder's beforePack hook, including the existing release workflow.
let buildPromise;
export default function beforePack() {
  return (buildPromise ??= generateAboutCredits());
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await generateAboutCredits();
}
