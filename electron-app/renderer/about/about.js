const $ = (id) => document.getElementById(id);

function contributorItem(person) {
  const item = document.createElement("li");
  // Authors without an associated GitHub account have no profile to open.
  const card = document.createElement(person.login ? "button" : "div");
  card.className = "contributor";
  card.title = person.login
    ? `Open ${person.name} on GitHub`
    : `${person.name} (unlinked author)`;
  if (person.login) {
    card.setAttribute("aria-label", `Open ${person.name} on GitHub`);
    card.addEventListener("click", async () => {
      $("link-error").hidden = true;
      try {
        await window.aboutAPI.openProfile(person.id);
      } catch {
        $("link-error").hidden = false;
      }
    });
  }
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  const initials = person.name
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
  avatar.textContent = initials;
  if (
    person.avatarUrl &&
    /^\.\/avatars\/[a-zA-Z0-9-]+\.(png|jpg|webp)$/.test(person.avatarUrl)
  ) {
    const image = document.createElement("img");
    image.src = person.avatarUrl;
    image.alt = "";
    image.addEventListener("error", () => {
      avatar.textContent = initials;
    });
    avatar.replaceChildren(image);
  }
  const details = document.createElement("span");
  details.className = "details";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = person.name;
  const count = document.createElement("span");
  count.className = "count";
  count.textContent = `${new Intl.NumberFormat("en-GB").format(person.contributions)} ${person.contributions === 1 ? "commit" : "commits"}`;
  details.append(name, count);
  card.append(avatar, details);
  item.append(card);
  return item;
}

window.aboutAPI
  .getCredits()
  .then((data) => {
    $("app-version").textContent = `Version ${data.version}`;
    const contributors = [...data.contributors].sort(
      (a, b) =>
        b.contributions - a.contributions || a.name.localeCompare(b.name),
    );
    $("contributors").replaceChildren(...contributors.map(contributorItem));
    $("credits-date").textContent =
      `GitHub credits · ${new Date(data.fetchedAt).toLocaleDateString("en-GB")} · Merges excluded`;
  })
  .catch(() => {
    $("load-error").hidden = false;
  });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.close();
});
