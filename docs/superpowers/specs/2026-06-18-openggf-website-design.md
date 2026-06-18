# OpenGGF Website — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design), pending implementation plan
**Owner:** farrellmacleod@gmail.com
**Repo (website):** `openggf-webzone` (to be a private GitHub repo)
**Repo (engine):** `jamesj999/OpenGGF` (branch `develop`)

## 1. Goal

Replace GitHub-based hosting with a statically-served, ridiculously cheap website for
**OpenGGF** — an open-source, OpenGL-accelerated, accurate Sonic engine written in Java — served
at **openggf.com**. The site has a custom animated homepage and a navigable documentation section
derived from the engine repo's docs. Visual language is taken from the OpenGGF Trace deck (Sonic 2
title-card aesthetic).

### Positioning

Lead with **"Open-Source Sonic Engine."** Headline the technology (OpenGL-accelerated, accurate,
Java). Parity/Trace work is a supporting detail, not the pitch.

## 2. Hosting & Deployment

- **Cloudflare Pages**, building from the private `openggf-webzone` GitHub repo.
  - Auto-deploy on every push to `main` (Pages' native GitHub integration).
  - Free tier, global CDN, free SSL. Effectively $0/mo at this scale.
- **Domain:** `openggf.com` pointed at Pages. Cleanest if the domain's DNS is on Cloudflare
  (add a custom domain in Pages); otherwise a CNAME to the `*.pages.dev` target. **DNS cutover is
  a deploy-time step, tracked as an open item.**
- Output is fully static. (R2 buckets were considered but Pages is simpler and gives CDN+SSL+CI
  for free; R2 remains an option only if raw S3-bucket semantics are ever needed.)

### Release-triggered rebuild (first-class requirement)

Downloads/Releases/hero-version are resolved from a committed `releases.cache.json` **at build
time**, but Pages only rebuilds on pushes to `openggf-webzone`, and a Pages build **cannot commit
back to the repo**. So a new `jamesj999/OpenGGF` release must (a) refresh the committed cache and
(b) trigger a rebuild. Both happen in a **webzone-side workflow**, not in the Pages build and not
via a bare deploy hook (a deploy hook would rebuild but never refresh the committed cache):

1. **Engine side** — a GitHub Action in `jamesj999/OpenGGF` fires on published release and sends a
   `repository_dispatch` event to `openggf-webzone` (using a fine-grained PAT stored as a secret):

   ```yaml
   # in jamesj999/OpenGGF
   on:
     release:
       types: [published]
   ```

2. **Webzone side** — a workflow in `openggf-webzone` listens for that event (plus a manual and a
   scheduled backstop), runs the cache-refresh script, and commits + pushes any change. The push
   is what triggers the Cloudflare Pages production build:

   ```yaml
   # in openggf-webzone
   on:
     repository_dispatch: { types: [engine-release] }
     workflow_dispatch: {}
     schedule: [{ cron: '0 6 * * *' }]   # daily backstop in case a dispatch is missed
   permissions:
     contents: write                     # REQUIRED so the job can push the cache commit;
                                         # org/repo default may be read-only otherwise
   ```
   The job runs `npm run refresh-cache` (writes `src/data/releases.cache.json` from the Releases
   API using the workflow `GITHUB_TOKEN`), then commits and pushes to `main` **only if the file
   changed**.
   - **The commit message MUST NOT contain any CI-skip directive** (`[skip ci]`, `[ci skip]`,
     `[skip pages]`, etc.). This push is precisely what must trigger the Pages production build —
     suppressing it would update the cache but never rebuild the site, silently breaking the
     "latest" path. Use a plain message such as `chore: refresh releases cache`.
   - **Loop prevention** (this push could otherwise re-trigger workflows) is handled **not** by
     skip directives but by scoping: this workflow only triggers on `repository_dispatch` /
     `workflow_dispatch` / `schedule` (never `on: push`), so its own commit cannot re-invoke it.
     If a `push`-triggered workflow is ever added, exclude `src/data/releases.cache.json` via a
     `paths-ignore` filter and/or guard on the committing actor.

3. **Pages build** — reads the now-updated committed cache (read-only). It may also attempt a live
   API fetch as the primary source, with the committed cache as the guaranteed fallback (§7).

This is the single mechanism for the "latest" promise — a **required** part of the design. The
cross-repo wiring (PAT secret + the engine workflow + the webzone workflow) is a deploy-time step,
tracked as an open item.

## 3. Stack & Key Libraries

- **Astro** — static-site generator. Zero JS shipped by default; full creative control over the
  homepage; content collections power the docs. No Starlight (we want full custom Trace styling).
- **GSAP + ScrollTrigger** — title-card "drop" animation and scroll-reveals. All motion gated
  behind `prefers-reduced-motion: reduce`.
- **Pagefind** — instant client-side static search over the docs (the nav `⌕` box). Astro does
  not produce a search index by itself: the build is `astro build && pagefind --site dist`
  (wired as the package `build` script). Pagefind crawls `dist/` post-build and emits its index +
  UI assets to `dist/pagefind/` (gitignored). The nav search loads `/pagefind/pagefind.js`
  dynamically on first focus and queries client-side — no server, no API.
- **Fonts:** Bungee + Archivo Black, self-hosted as woff2.
- **Palette:** cobalt `#1A4FE6`, red `#E62B33`, signpost yellow `#FFD81F`, ink `#0E0E10`.

## 4. Repository Structure & Doc Sync

Model: **split by audience.** Dev/code-adjacent docs remain *sourced* in `sonic-engine` and are
synced into the website; marketing/news/homepage content is *authored* in `openggf-webzone`.
Nothing dev-facing is pruned from `sonic-engine`; the website is the public presentation layer.

```
openggf-webzone/
  astro.config.mjs
  package.json
  scripts/
    sync-docs.mjs          # copies allowlisted docs from ../sonic-engine
    refresh-cache.mjs      # writes src/data/releases.cache.json from Releases API
  .github/workflows/
    refresh-on-release.yml # repository_dispatch + schedule: refresh cache, commit, push
  src/
    components/            # TitleCardHero, ActPlateHeader, ZigzagBand/Divider,
                           # SectionDownload/Releases/News/Faq, DocsSidebar, DocsTOC, NavBar, Footer
    layouts/               # BaseLayout, DocLayout
    content/
      docs/                # VENDORED, synced from sonic-engine (committed)
      news/                # markdown posts authored here
      config.ts            # content collection schemas
    data/
      faq.yaml             # FAQ entries
      download-platforms.yaml  # OS labels/icons -> release-asset matchers
      releases.cache.json  # committed last-known-good GitHub release data (fallback)
    pages/
      index.astro          # homepage
      news/[...slug].astro, news/index.astro
      docs/index.astro     # docs hub (Play / Contribute / Cross-reference cards)
      docs/[...slug].astro # rendered doc pages
  public/
    media/hero-poster.jpg  # placeholder until real hero video exists
    fonts/
```

### Doc allowlist (curated public set)

Synced from `sonic-engine`:
- `docs/guide/**` (Players, Contributors, Cross-referencing)
- `CONFIGURATION.md`, `ROADMAP.md`, `CREDITS.md`, `CONTRIBUTING.md`
- README intro content (or a curated subset)

**Excluded** (internal): `BUGLIST*`, `docs/agent-workflow/**`, `docs/archive/**`, crash/replay
logs, ArchUnit evaluations, doc-gap audits, disassembly mirrors, `*.htm` research dumps.

`sync-docs.mjs`:
- **Source path:** resolved from `--engine-path <dir>` CLI arg, else `$OPENGGF_ENGINE_PATH` env
  var, else default `../sonic-engine` (this matches the local checkout folder name — note the
  GitHub repo is `OpenGGF` but the working copy here is `sonic-engine`). The script does **not**
  clone or fetch; it reads an existing local checkout.
- **Expected branch:** `develop` (the active branch). The script logs the detected branch and
  warns (does not fail) if it differs, so a release-tag checkout can still be synced deliberately.
- **Validation:** if the resolved path doesn't exist or isn't a git repo containing
  `docs/guide/`, exit non-zero with a clear message, e.g.
  `sync-docs: engine repo not found at "<path>". Pass --engine-path or set OPENGGF_ENGINE_PATH.`
- Copies only the allowlist into `src/content/docs/`, normalising frontmatter (title, group,
  order) and rewriting relative links between docs.
- Output is committed (vendored) so the Cloudflare build needs only the webzone repo — fast,
  reproducible, offline-capable. Re-run + push to publish doc changes. (CI never runs the sync;
  it builds from the vendored copy.)

## 5. Homepage ("Signpost Stack" layout, A)

Vertical scroll story, sticky nav, sections in order:

1. **Nav (sticky):** Bungee `OpenGGF` wordmark · `Docs ▾` · Download · Releases · News · FAQ ·
   search `⌕` · GitHub. Dark ink bar, yellow accents.
2. **Title-card hero (framed, gentle teeth — V2 refined):**
   - Cobalt background; **red zigzag band left, yellow zigzag band right**, ~25% width, shallow
     (~10%) teeth on a tall pitch (matches the deck polygon).
   - Bungee `OpenGGF` with thick black stroke; yellow **Archivo Black italic** "Open-Source Sonic
     Engine" subtitle (styled like the deck's "Trace"); ink sub-plate "OpenGL-accelerated ·
     accurate · Java".
   - Rotated yellow **version act-plate** (top-right). **Version source:** the tag name of the
     latest **non-prerelease** GitHub Release of `jamesj999/OpenGGF` (same build-time fetch as the
     Releases section, single shared fetch). **Fallbacks, in order:** if no stable release exists,
     use the latest prerelease and mark it `(pre)`; if the API fails or returns nothing, fall back
     to a build-time-injected `SITE_FALLBACK_VERSION` constant and, failing that, hide the plate
     rather than render an error. The fetch is non-fatal — an API failure never breaks the build.
   - **Hero video placeholder:** poster image + `<video>` slot, autoplay/muted/loop/playsinline,
     `prefers-reduced-motion` falls back to the poster. Real video to be created later.
   - CTAs: Download (yellow) + Read the Docs.
   - **Animation:** on load bands slide in from edges, plate stamps down with a bounce, wordmark
     zooms-and-snaps (title-card "drop"), video fades up. Drop replays per-section on scroll.
3. **Zigzag divider** (repeats between sections).
4. **Download** — per-OS buttons (Windows/macOS/Linux) linking latest GitHub Release assets;
   ROM/JDK note.
5. **Releases** — version list + changelog highlights from the GitHub Releases API.
6. **News** — latest markdown posts as cards; link to news index.
7. **FAQ** — accordion from `faq.yaml`.
8. **Footer** — Sega disclaimer, GitHub, Discord, license.

Section headers: **skewed act-plate headers** (style A). Sections alternate paper/white.

## 6. Docs Section

- `Docs` → **hub page** (C): three big cards — Play / Contribute / Cross-reference.
- Then **grouped sidebar** (by audience: Players / Contributors / Cross-referencing) + content +
  right-hand on-page TOC.
- Content styling: act-plate section tags, Bungee headings, yellow-edged code blocks, Trace
  palette.
- **Pagefind** search in the nav.

## 7. Data Sources

| Surface      | Source                                                      | When / refresh                       |
|--------------|------------------------------------------------------------|--------------------------------------|
| Downloads    | Latest **GitHub Releases assets** of `jamesj999/OpenGGF`    | build time; cache-refresh workflow + webzone push (§2) |
| Releases     | **GitHub Releases API** (`jamesj999/OpenGGF`)              | build time; cache-refresh workflow + webzone push (§2) |
| Hero version | Latest non-prerelease tag (same fetch as Releases)         | build time; cache-refresh workflow + webzone push (§2) |
| News         | Markdown posts in `src/content/news/` → cards + index + RSS | build time (webzone push)            |
| FAQ          | `src/data/faq.yaml`                                         | build time (webzone push)            |
| Docs         | Vendored sync from engine allowlist                        | sync script + webzone push           |

The three GitHub-sourced surfaces share a **single build-time fetch** of the Releases API and stay
current via the **release-triggered rebuild** (§2). Per-OS download mapping lives in
`download-platforms.yaml` (label/icon → asset-name matcher), so new release asset naming is handled
without code changes. The build uses an optional `GITHUB_TOKEN` to avoid API rate limits in CI; the
fetch is wrapped so any failure degrades gracefully rather than failing the build.

### Degradation contract (failure / empty state)

The "non-fatal build" requirement is not enough on its own — implementers must hit these exact
behaviours so a degraded fetch never ships empty or broken primary CTAs. Tiering per surface:

- **Cached snapshot (the source the Pages build reads):** `src/data/releases.cache.json` is
  committed and is **refreshed only by the webzone-side refresh workflow / local
  `npm run refresh-cache`** (§2) — never by the Pages build, which is read-only. The build prefers
  a live API fetch and falls back to this committed snapshot, so it always renders real (if
  slightly stale) data.
- **Downloads:**
  - *Live or cached data present* → per-OS buttons as designed.
  - *An OS has no matching asset* → that OS button links to the GitHub Releases **page** (not a
    dead/hidden button) with a small "find your build" note:
    `https://github.com/jamesj999/OpenGGF/releases`
  - *No data at all (live fetch fails AND no committed cache)* → replace the per-OS row with a
    **single primary "Download from GitHub →" button** linking to the literal URL
    `https://github.com/jamesj999/OpenGGF/releases/latest`. The CTA is never empty.
- **Releases:**
  - *Live or cached data present* → version list + changelog as designed.
  - *No data at all* → render a compact "View all releases on GitHub →" link-out card
    (`https://github.com/jamesj999/OpenGGF/releases`) instead of
    an empty list. No empty section, no error text.
- **Hero version:** as already specified — latest stable tag → prerelease `(pre)` →
  `SITE_FALLBACK_VERSION` → hide plate.

In all cases the build succeeds; the difference is purely which fallback render is emitted.

## 8. Components (isolation & responsibilities)

Each is independently testable with a clear interface:

- `NavBar` — links + search trigger; props: active section.
- `TitleCardHero` — bands, plate, wordmark, video slot, CTAs; props: version, video/poster src.
- `ZigzagBand` / `ZigzagDivider` — parameterised teeth (depth, count, colour, side).
- `ActPlateHeader` — skewed section header; props: label, accent.
- `SectionDownload` / `SectionReleases` / `SectionNews` / `SectionFaq` — data in, section out.
- `DocsSidebar` / `DocsTOC` / `DocLayout` — docs navigation + rendering.
- `Footer`.

## 9. Accessibility & Performance

- All animation respects `prefers-reduced-motion`; video falls back to poster.
- Outlined/stroked text retains accessible contrast; semantic headings; keyboard-navigable nav,
  accordion, and sidebar.
- Astro ships minimal JS; images optimised; fonts woff2 + `font-display: swap`.

## 10. Open Items (non-blocking)

- **Hero video** — to be created; scaffold uses a poster placeholder.
- **openggf.com DNS cutover** — performed at deploy time once Pages is live.
- **Webzone GitHub repo + Pages project** — created at deploy time (private repo, connect to
  Pages, add custom domain).
- **Release webhook wiring** — the cross-repo refresh path from §2: (a) a fine-grained PAT secret
  granting `repository_dispatch` to `openggf-webzone`, (b) the release-published workflow in
  `jamesj999/OpenGGF` that dispatches it (the `release.types: [published]` trigger defined in §2),
  and (c) the `refresh-on-release.yml` workflow in webzone that refreshes the cache, commits, and
  pushes. Required for the "latest" promise; done at deploy time since it spans both repos.
