import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { getAboutCredits } from "../githubCredits.js";
import { generateAboutCredits } from "../generateCredits.js";

const sha = (id) => id.toString(16).padStart(40, "0");
function commit(id, member = 1, parents = 1) {
  return {
    sha: sha(id),
    parents: Array.from({ length: parents }, (_, index) => ({
      sha: sha(id + index + 1000),
    })),
    author: { id: member, login: `member-${member}`, type: "User" },
    commit: {
      message: "A change",
      author: {
        name: `Member ${member}`,
        email: `member-${member}@example.com`,
      },
    },
  };
}
const response = (data) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
const photoResponse = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), {
    headers: { "content-type": "image/png" },
  });
async function options(fetchImpl) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "about-build-"));
  return {
    fetchImpl,
    snapshotPath: path.join(directory, "credits.json"),
    avatarDirectory: path.join(directory, "avatars"),
    token: "test-token",
    warn: vi.fn(),
  };
}
const apiFor = (commits) =>
  vi.fn(async (url) =>
    url.includes("api.github.com") ? response(commits) : photoResponse(),
  );

it("reads sorted bundled credits without any runtime fetch", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  try {
    const credits = getAboutCredits();
    expect(credits.contributors.length).toBeGreaterThan(0);
    expect(credits.contributors.some((person) => person.type === "Bot")).toBe(
      false,
    );
    const counts = credits.contributors.map((person) => person.contributions);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});

it("ships a snapshot explicitly generated without merges", async () => {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../credits.snapshot.json", import.meta.url),
      "utf8",
    ),
  );
  expect(snapshot.counting).toBe("non-merge");
  expect(snapshot.schemaVersion).toBe(3);
  expect(snapshot.headSha).toMatch(/^[a-f0-9]{40}$/);
});

it("counts non-merge commits, not the merge-inclusive contributors total", async () => {
  const root = commit(1, 2, 0);
  const normal = commit(2, 2);
  normal.commit.message = "Merge is part of this ordinary commit's title";
  const merge = commit(3, 2, 2);
  const octopus = commit(4, 2, 3);
  const fetchImpl = apiFor([root, normal, merge, octopus, commit(5, 1)]);
  const config = await options(fetchImpl);
  const data = await generateAboutCredits(config);
  expect(data.counting).toBe("non-merge");
  expect(data.headSha).toBe(root.sha);
  expect(
    data.contributors.map((person) => [person.login, person.contributions]),
  ).toEqual([
    ["member-2", 2],
    ["member-1", 1],
  ]);
  expect(data.contributors[0].avatarUrl).toBe("./avatars/2.png");
  expect(await readFile(path.join(config.avatarDirectory, "2.png"))).toEqual(
    Buffer.from([137, 80, 78, 71]),
  );
  expect(JSON.parse(await readFile(config.snapshotPath, "utf8"))).toEqual(data);
  expect(JSON.stringify(data)).not.toContain("@example.com");
  expect(JSON.stringify(data)).not.toContain("test-token");
  expect(
    fetchImpl.mock.calls.find(([url]) => url.includes("api.github.com"))[1]
      .headers.Authorization,
  ).toBe("Bearer test-token");
  expect(
    fetchImpl.mock.calls.find(([url]) =>
      url.includes("avatars.githubusercontent.com"),
    )[1].headers,
  ).toBeUndefined();
});

it("groups account aliases, keeps distinct unlinked authors and excludes bots", async () => {
  const alias = commit(2);
  alias.commit.author.name = "Another name";
  alias.commit.author.email = "another-address@example.com";
  const unlinked = commit(3);
  unlinked.author = null;
  unlinked.commit.author = { name: "Early author", email: "early@example.com" };
  const unlinkedAgain = structuredClone(unlinked);
  unlinkedAgain.sha = sha(4);
  const otherUnlinked = structuredClone(unlinked);
  otherUnlinked.sha = sha(5);
  otherUnlinked.commit.author.email = "different@example.com";
  const bot = commit(6, 3);
  bot.author.type = "Bot";
  const data = await generateAboutCredits(
    await options(
      apiFor([commit(1), alias, unlinked, unlinkedAgain, otherUnlinked, bot]),
    ),
  );
  expect(data.contributors.map((person) => person.contributions)).toEqual([
    2, 2, 1,
  ]);
  expect(
    data.contributors.filter((person) => person.login === null),
  ).toHaveLength(2);
  expect(
    data.contributors.find((person) => person.login === "member-1")
      .contributions,
  ).toBe(2);
  expect(JSON.stringify(data)).not.toContain("@example.com");
});

it("paginates the complete history pinned to a SHA and counts each commit once", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) =>
    commit(index + 1),
  );
  const fetchImpl = vi.fn(async (url) => {
    if (url.includes("avatars.githubusercontent.com")) return photoResponse();
    return response(
      url.endsWith("page=1") ? firstPage : [firstPage[99], commit(101)],
    );
  });
  const data = await generateAboutCredits(await options(fetchImpl));
  expect(data.contributors[0].contributions).toBe(101);
  expect(fetchImpl).toHaveBeenCalledWith(
    expect.stringContaining(`/commits?sha=${sha(1)}&per_page=100&page=2`),
    expect.anything(),
  );
});

it("reuses a previously verified non-merge snapshot when the history head is unchanged", async () => {
  const fetchImpl = apiFor([commit(1)]);
  const config = await options(fetchImpl);
  const data = await generateAboutCredits(config);
  fetchImpl.mockClear();
  expect(await generateAboutCredits(config)).toEqual(data);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it("keeps the complete non-merge snapshot on offline or partial failures", async () => {
  const config = await options(
    vi.fn(async () => {
      throw new Error("Offline");
    }),
  );
  const previous = {
    counting: "non-merge",
    headSha: sha(500),
    contributors: [
      { id: "1", login: "member-1", name: "member-1", contributions: 1 },
    ],
    fetchedAt: "2026-10-21T11:00:00Z",
  };
  await writeFile(config.snapshotPath, JSON.stringify(previous));
  expect(await generateAboutCredits(config)).toEqual(previous);
  config.fetchImpl.mockImplementation(async (url) =>
    url.endsWith("page=1")
      ? response(Array.from({ length: 100 }, (_, index) => commit(index + 1)))
      : new Response("Rate limited", { status: 403 }),
  );
  expect(await generateAboutCredits(config)).toEqual(previous);
  expect(JSON.parse(await readFile(config.snapshotPath, "utf8"))).toEqual(
    previous,
  );
});

it("never silently falls back to legacy merge-inclusive counts", async () => {
  const config = await options(
    vi.fn(async () => {
      throw new Error("Offline");
    }),
  );
  await writeFile(
    config.snapshotPath,
    JSON.stringify({ contributors: [{ id: "1", contributions: 986 }] }),
  );
  await expect(generateAboutCredits(config)).rejects.toThrow("Offline");
});

it("keeps a saved photo on download failure and uses initials for new authors", async () => {
  const fetchImpl = apiFor([commit(1)]);
  const config = await options(fetchImpl);
  await generateAboutCredits(config);
  fetchImpl.mockImplementation(async (url) =>
    url.includes("api.github.com")
      ? response([commit(2), commit(3, 2)])
      : new Response("Offline", { status: 503 }),
  );
  const data = await generateAboutCredits(config);
  expect(data.contributors.find((person) => person.id === "1").avatarUrl).toBe(
    "./avatars/1.png",
  );
  expect(
    data.contributors.find((person) => person.id === "2").avatarUrl,
  ).toBeNull();
});

it("fails a first build without data instead of silently generating empty credits", async () => {
  const config = await options(apiFor([]));
  await expect(generateAboutCredits(config)).rejects.toThrow("no contributors");
});

it("wires generation into electron-builder and the local Electron build", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  expect(packageJson.build.beforePack).toBe("./src/about/generateCredits.js");
  expect(packageJson.scripts["build:credits"]).toBe(
    "node src/about/generateCredits.js",
  );
  const localBuild = await readFile(
    new URL("../../../build.mjs", import.meta.url),
    "utf8",
  );
  expect(localBuild).toContain("await generateAboutCredits()");
});
