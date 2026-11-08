/**
 * The About screen reads electron-app/src/about/credits.snapshot.json and the
 * avatars next to it. Both are generated from the GitHub API at build time and
 * deliberately not committed (they are contributor photographs and per-person
 * commit counts, in a public repository), so a fresh clone — every CI run —
 * has neither, About lists nobody and tests/ui/about.test.ts cannot find a
 * single contributor.
 *
 * The suite must not fetch them either: the About tests assert that the screen
 * is entirely network-free, and making every pull request depend on the GitHub
 * commits API would be slow and flaky. So seed a fixed, offline snapshot plus
 * matching images, and leave a real generated snapshot alone when there is one,
 * so a developer's own build keeps being what the tests exercise locally.
 */
import { deflateSync } from "node:zlib";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ELECTRON_APP = fileURLToPath(
  new URL("../../electron-app/", import.meta.url),
);
const SNAPSHOT = path.join(ELECTRON_APP, "src/about/credits.snapshot.json");
const AVATARS = path.join(ELECTRON_APP, "renderer/about/avatars");
// The renderer only builds an <img> for a path shaped like this one.
const AVATAR_URL = /^\.\/avatars\/[a-zA-Z0-9-]+\.(png|jpg|webp)$/;

// Ids far outside GitHub's range for this repository's members, so the fixture
// images can never be mistaken for, or overwrite, a real contributor's photo.
// Descending, distinct counts: the first test asserts the list is sorted and
// the second one opens the top member's profile, which needs a login.
const FIXTURE = [
  {
    id: "900000001",
    login: "e2e-ada",
    contributions: 128,
    colour: [64, 110, 235],
  },
  {
    id: "900000002",
    login: "e2e-grace",
    contributions: 57,
    colour: [217, 72, 140],
  },
  {
    id: "900000003",
    login: "e2e-linus",
    contributions: 9,
    colour: [48, 168, 122],
  },
];

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/**
 * Encodes a solid square as a real PNG. The test requires each avatar to
 * decode in the renderer (`naturalWidth > 0`), so these are complete images
 * rather than placeholder bytes, and no binary fixture needs committing.
 * @param {number} size - Side length in pixels.
 * @param {[number, number, number]} colour - 8-bit RGB fill.
 * @returns {Buffer}
 */
function solidPng(size, colour) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let row = 0; row < size; row++) {
    raw[row * stride] = 0; // Filter type 0: no filtering.
    for (let column = 0; column < size; column++) {
      const pixel = row * stride + 1 + column * 3;
      raw[pixel] = colour[0];
      raw[pixel + 1] = colour[1];
      raw[pixel + 2] = colour[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bit depth.
  header[9] = 2; // Colour type: truecolour RGB.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Reports whether the snapshot on disk can carry the About tests: it must
 * list somebody, be counted the way getAboutCredits() demands, name at least
 * one GitHub profile to open, and reference only images that are still there,
 * because a missing file leaves an <img> that never loads.
 * @returns {Promise<boolean>}
 */
async function hasUsableCredits() {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  } catch {
    return false;
  }
  const people = snapshot?.contributors;
  if (snapshot?.counting !== "non-merge" || !Array.isArray(people))
    return false;
  const listed = people.filter((person) => person.type !== "Bot");
  if (!listed.length || !listed.some((person) => person.login)) return false;
  const images = listed
    .map((person) => person.avatarUrl)
    .filter((url) => typeof url === "string" && url);
  if (!images.length || !images.every((url) => AVATAR_URL.test(url)))
    return false;
  const present = await Promise.all(
    images.map((url) =>
      access(path.join(AVATARS, path.basename(url))).then(
        () => true,
        () => false,
      ),
    ),
  );
  return present.every(Boolean);
}

/**
 * Writes the offline About fixture unless a usable generated snapshot is
 * already on disk.
 * @returns {Promise<"fixture" | "generated">} Which credits the tests will read.
 */
export async function seedAboutCredits() {
  if (await hasUsableCredits()) return "generated";
  await mkdir(AVATARS, { recursive: true });
  await mkdir(path.dirname(SNAPSHOT), { recursive: true });
  await Promise.all(
    FIXTURE.map((person) =>
      writeFile(
        path.join(AVATARS, `${person.id}.png`),
        solidPng(96, person.colour),
      ),
    ),
  );
  await writeFile(
    SNAPSHOT,
    `${JSON.stringify(
      {
        schemaVersion: 3,
        repository: "Hyperloop-UPV/software",
        counting: "non-merge",
        // No revision, so the next real build refetches instead of reusing this.
        headSha: null,
        fetchedAt: "2026-01-02T03:04:05.000Z",
        contributors: FIXTURE.map(({ id, login, contributions }) => ({
          id,
          login,
          name: login,
          contributions,
          avatarUrl: `./avatars/${id}.png`,
          type: "User",
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return "fixture";
}
