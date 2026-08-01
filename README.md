# nepo-babies extension

Chrome content script that flags actors on Letterboxd film pages who have a
parent with their own Wikipedia page, using the dataset produced by the
[nepo-babies-scraper](https://github.com/SomeLikeItChott/nepo-babies-scraper)
repo.

## How it works

`src/content.ts` runs on two kinds of Letterboxd pages. On every page load it
reads whatever dataset is currently cached in `chrome.storage.local` and
renders immediately — never delayed by a network call:

- **Film pages** (`letterboxd.com/film/*`): reads the cast list
  (`.cast-list.text-sluglist a.text-slug[href^="/actor/"]`), pulls the
  Letterboxd slug out of each actor link's `href`, and looks it up. Matches
  get a `nepo-badge` class (recolors the existing cast-list pill) and a
  custom hover tooltip showing the notable parent(s), e.g. "Father: Actor,
  Producer, and Director John Doe". This tooltip is `pointer-events: none`
  and plain text — it's a separate DOM element from Letterboxd's own (the
  cast list links already use `title` + a `tooltip` class for Letterboxd's
  own character-name hover popup, which this extension deliberately leaves
  alone).
- **Actor pages** (`letterboxd.com/actor/*`): reads the slug directly out of
  the URL, and if it's a match, inserts a banner right after the `<h1>` name
  heading: "🚨 **Potential nepo baby detected** 🚨", each parent on its own
  line. Unlike the tooltip, this renders real `<a>` links — the parent's
  name links to their own Letterboxd page (`letterboxdSlug`) when the
  scraper found one, falling back to their Wikipedia article
  (`wikipediaUrl`, always present) otherwise.

The dataset is fetched, not bundled and shipped for good — the extension
release cycle is decoupled from the scraper's own weekly refresh cycle:

- **First-ever run** (fresh install, empty storage): seeds from the
  gzip-compressed `data/nepo-babies.json.gz` bundled in the package, so the
  extension works immediately with zero network dependency.
- **Every page load after that**: renders from storage, then — fire and
  forget, after rendering — checks whether the cached copy is 7+ days old
  and if so fetches a fresh one from `DATASET_URL` (a GitHub Pages URL the
  scraper repo's weekly GitHub Actions job publishes to). A stored
  `lastFetchedAt` timestamp is written *before* the fetch resolves, so
  several Letterboxd tabs open at once don't all fire redundant requests.
  A failed fetch (e.g. Pages down) just leaves the existing cached copy in
  place and retries on a later page load — the extension never breaks, it
  just goes stale.

Either way, `content.ts` decompresses the gzip payload client-side via the
browser's native `DecompressionStream("gzip")` — no new dependency needed.

Each relation's raw `occupations` list from Wikidata is unordered and often
oddly specific ("stage actor", "television actor", "film director") rather
than the simple category a reader cares about. `content.ts`'s
`canonicalizeOccupation` collapses every matching label down to one of four
canonical categories (Actor, Director, Producer, Screenwriter — showbiz
roles first, in that priority order, everything else afterward), so e.g.
"stage actor" and "television actor" both just become a single "Actor"
rather than eating two of the three display slots (`MAX_OCCUPATIONS_SHOWN`).

## Build & load

```sh
npm install
npm run build-data   # downloads the latest published dataset into data/nepo-babies.json.gz
npm run build        # compiles src/content.ts -> dist/content.js
```

Then in Chrome: `chrome://extensions` → enable Developer Mode → **Load
unpacked** → select this `extension/` directory.

`build-data` only refreshes the bundled *fallback* snapshot (what a fresh
install seeds from before its first successful network fetch) — it's worth
re-running before cutting a new store release, but day-to-day dataset
freshness for existing installs comes from the runtime fetch described
above, not from rebuilding the extension.

## Known MVP Limitations

- **Inherits the scraper's limitations**: candidate set is bounded by TMDB's
  popularity ranking and page cap (not a full sweep of all actors),
  father/mother relations only (no siblings/family yet), slug resolution is
  a best-effort heuristic, and not every parent resolves to a Letterboxd
  page (falls back to Wikipedia) — see the
  [nepo-babies-scraper](https://github.com/SomeLikeItChott/nepo-babies-scraper)
  README.
- **Runtime freshness depends on GitHub Pages staying up** — mitigated by
  always falling back to the last successfully cached (or bundled) dataset
  rather than failing outright, but a prolonged outage means stale data
  rather than an error.
- **Chrome only** (Manifest V3). Porting to Firefox should be low-cost later
  since Firefox supports MV3, but hasn't been tried.
- Assumes the cast list / actor name heading are present in the initial
  server-rendered HTML (true
  as of this writing) — if Letterboxd ever moves it to client-side
  rendering or lazy-loads it, this content script would need to switch to a
  `MutationObserver` instead of a single DOM query at load time.
