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

## 3. Stack & Key Libraries

- **Astro** — static-site generator. Zero JS shipped by default; full creative control over the
  homepage; content collections power the docs. No Starlight (we want full custom Trace styling).
- **GSAP + ScrollTrigger** — title-card "drop" animation and scroll-reveals. All motion gated
  behind `prefers-reduced-motion: reduce`.
- **Pagefind** — instant client-side static search over the docs (the nav `⌕` box).
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
- Reads from a configurable local path (default `../sonic-engine`).
- Copies only the allowlist into `src/content/docs/`, normalising frontmatter (title, group,
  order) and rewriting relative links between docs.
- Output is committed (vendored) so the Cloudflare build needs only the webzone repo — fast,
  reproducible, offline-capable. Re-run + push to publish doc changes.

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
   - Rotated yellow **version act-plate** (top-right), version pulled dynamically.
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

| Surface   | Source                                                      | When        |
|-----------|------------------------------------------------------------|-------------|
| Downloads | Latest **GitHub Releases assets** of `jamesj999/OpenGGF`    | build time  |
| Releases  | **GitHub Releases API** (`jamesj999/OpenGGF`)              | build time  |
| News      | Markdown posts in `src/content/news/` → cards + index + RSS | build time  |
| FAQ       | `src/data/faq.yaml`                                         | build time  |
| Docs      | Vendored sync from `sonic-engine` allowlist                | sync script |

Per-OS download mapping lives in `download-platforms.yaml` (label/icon → asset-name matcher), so
new release asset naming can be handled without code changes. GitHub API calls at build use an
optional token to avoid rate limits in CI.

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
