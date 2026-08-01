// How many occupations to show per parent, and in what priority order —
// showbiz roles surface first since they're most relevant to a Letterboxd
// audience, everything else (e.g. "socialite", "athlete") falls in after.
const MAX_OCCUPATIONS_SHOWN = 3;

// Wikidata's raw occupation labels are often oddly specific ("stage actor",
// "television actor", "film director") rather than the simple category a
// reader actually cares about. Each of these collapses every matching raw
// label down to one canonical category, in priority order — so e.g. "stage
// actor" and "television actor" both just become a single "Actor" rather
// than eating two of the three display slots.
const OCCUPATION_CATEGORIES: { keywords: string[]; label: string }[] = [
  { keywords: ["actor", "actress"], label: "Actor" },
  { keywords: ["director"], label: "Director" },
  { keywords: ["producer"], label: "Producer" },
  { keywords: ["screenwriter", "writer"], label: "Screenwriter" },
];

// GitHub Pages URL a weekly GitHub Actions job (in the nepo-babies-scraper
// repo) publishes a fresh nepo-babies.json.gz to.
const DATASET_URL = "https://somelikeitchott.github.io/nepo-babies-scraper/nepo-babies.json.gz";

const STORAGE_KEY_DATASET = "nepoDataset";
const STORAGE_KEY_LAST_FETCHED_AT = "nepoLastFetchedAt";
const MIN_FETCH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

async function decompressGzipResponse(res: Response): Promise<NepoDataset> {
  const decompressed = res.body!.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressed).text();
  return JSON.parse(text);
}

// Only used to seed local storage on a brand-new install, before the first
// successful fetch of DATASET_URL ever happens — see getCachedDataset().
async function loadBundledDataset(): Promise<NepoDataset> {
  const url = chrome.runtime.getURL("data/nepo-babies.json.gz");
  const res = await fetch(url);
  return decompressGzipResponse(res);
}

async function fetchRemoteDataset(): Promise<NepoDataset> {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return decompressGzipResponse(res);
}

// Renders immediately from whatever's cached (bundled snapshot on a
// brand-new install, otherwise the last successful fetch) — never waits on
// a network call, so this can't add latency to the page.
async function getCachedDataset(): Promise<NepoDataset> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_DATASET);
  const cached = stored[STORAGE_KEY_DATASET] as NepoDataset | undefined;
  if (cached) return cached;

  const bundled = await loadBundledDataset();
  await chrome.storage.local.set({ [STORAGE_KEY_DATASET]: bundled });
  return bundled;
}

// Fire-and-forget from main(), run *after* rendering. Fetches at most once
// a week: the timestamp is written before the fetch resolves (not just on
// success) so that several Letterboxd tabs open at once don't all fire a
// redundant request — only the first to check wins, the rest see a
// fresh-enough timestamp and skip. A failed fetch just leaves the existing
// cached copy in place and retries on a later page load.
async function maybeRefreshDataset(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_LAST_FETCHED_AT);
  const lastFetchedAt = stored[STORAGE_KEY_LAST_FETCHED_AT] as number | undefined;
  if (lastFetchedAt && Date.now() - lastFetchedAt < MIN_FETCH_INTERVAL_MS) return;

  await chrome.storage.local.set({ [STORAGE_KEY_LAST_FETCHED_AT]: Date.now() });

  try {
    const fresh = await fetchRemoteDataset();
    await chrome.storage.local.set({ [STORAGE_KEY_DATASET]: fresh });
  } catch (err) {
    console.warn("nepo-babies: dataset refresh failed, keeping cached copy", err);
  }
}

function slugFromHref(href: string): string | null {
  const match = href.match(/^\/actor\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function slugFromPathname(): string | null {
  const match = window.location.pathname.match(/^\/actor\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function toTitleCase(label: string): string {
  // Capitalize after whitespace/hyphens (so "singer-songwriter" ->
  // "Singer-Songwriter"), but not after an apostrophe — \b treats the
  // apostrophe in "women's" as a word boundary too, which mangled it into
  // "Women'S".
  return label.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());
}

function canonicalizeOccupation(occupation: string): { label: string; priority: number } {
  const lower = occupation.toLowerCase();
  const index = OCCUPATION_CATEGORIES.findIndex((c) => c.keywords.some((k) => lower.includes(k)));
  return index === -1
    ? { label: toTitleCase(occupation), priority: OCCUPATION_CATEGORIES.length }
    : { label: OCCUPATION_CATEGORIES[index].label, priority: index };
}

function formatOccupations(occupations: string[]): string {
  const canonical = occupations
    .map(canonicalizeOccupation)
    .sort((a, b) => a.priority - b.priority);

  const shown: string[] = [];
  for (const { label } of canonical) {
    if (shown.includes(label)) continue;
    shown.push(label);
    if (shown.length === MAX_OCCUPATIONS_SHOWN) break;
  }

  if (shown.length === 0) return "";
  if (shown.length === 1) return shown[0];
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return `${shown.slice(0, -1).join(", ")}, and ${shown[shown.length - 1]}`;
}

function relationPrefix(r: Relation): string {
  const roleLabel = r.type === "father" ? "Father" : "Mother";
  const occupations = formatOccupations(r.occupations);
  return occupations ? `${roleLabel}: ${occupations} ` : `${roleLabel}: `;
}

function describeRelation(r: Relation): string {
  return `${relationPrefix(r)}${r.name}`;
}

function describeRelations(relations: Relation[]): string {
  return relations.map(describeRelation).join(" · ");
}

// Unlike describeRelation (plain text, used by the hover tooltip, which is
// pointer-events: none so a link there wouldn't be clickable anyway), this
// appends real DOM nodes so the parent's name can be a clickable link to
// their own Letterboxd page when we found one.
function appendRelation(container: HTMLElement, relation: Relation) {
  container.append(relationPrefix(relation));

  // Prefer linking to the parent's own Letterboxd page; fall back to their
  // Wikipedia article (always present — it's the inclusion criterion for
  // being in the dataset at all) when no Letterboxd page could be found.
  const href = relation.letterboxdSlug ? `/actor/${relation.letterboxdSlug}/` : relation.wikipediaUrl;
  const link = document.createElement("a");
  link.href = href;
  link.textContent = relation.name;
  container.append(link);
}

function renderActorPageBanner(entry: NepoEntry) {
  const heading = document.querySelector<HTMLElement>("h1.title-1.prettify");
  if (!heading) return;

  const banner = document.createElement("p");
  banner.className = "nepo-actor-banner";

  const label = document.createElement("strong");
  label.textContent = "🚨 Potential nepo baby detected 🚨";
  banner.append(label);

  entry.relations.forEach((relation) => {
    banner.append(document.createElement("br"));
    appendRelation(banner, relation);
  });

  heading.insertAdjacentElement("afterend", banner);
}

function createTooltip(): HTMLDivElement {
  const tip = document.createElement("div");
  tip.className = "nepo-tooltip";
  document.body.appendChild(tip);
  return tip;
}

function attachTooltip(link: HTMLAnchorElement, tooltip: HTMLDivElement, entry: NepoEntry) {
  link.addEventListener("mouseenter", () => {
    tooltip.textContent = describeRelations(entry.relations);
    const rect = link.getBoundingClientRect();
    const tooltipWidth = tooltip.getBoundingClientRect().width;
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    tooltip.classList.add("visible");
  });
  link.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });
}

async function main() {
  const dataset = await getCachedDataset();

  const links = document.querySelectorAll<HTMLAnchorElement>(
    '.cast-list.text-sluglist a.text-slug[href^="/actor/"]',
  );

  if (links.length > 0) {
    const tooltip = createTooltip();

    links.forEach((link) => {
      const slug = slugFromHref(link.getAttribute("href") ?? "");
      if (!slug) return;

      const entry = dataset[slug];
      if (!entry) return;

      link.classList.add("nepo-badge");
      attachTooltip(link, tooltip, entry);
    });
  }

  const actorSlug = slugFromPathname();
  if (actorSlug) {
    const entry = dataset[actorSlug];
    if (entry) renderActorPageBanner(entry);
  }

  void maybeRefreshDataset();
}

main();
