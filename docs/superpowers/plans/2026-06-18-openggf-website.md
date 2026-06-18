# OpenGGF Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a statically-served, Cloudflare-Pages-hosted website for OpenGGF (openggf.com) with a Trace-themed animated homepage and a navigable docs section synced from the engine repo.

**Architecture:** Astro static site, fully custom Trace-skinned components. GitHub Releases data is fetched at build time with a committed `releases.cache.json` fallback; a webzone-side GitHub Action refreshes that cache and pushes (the push triggers the Pages build). Docs are vendored into the repo by a sync script that reads an allowlist from a local `sonic-engine` checkout. Search is static via Pagefind run after `astro build`.

**Tech Stack:** Astro, TypeScript, GSAP + ScrollTrigger, Pagefind, @astrojs/rss, Vitest (+ Astro Container API), @fontsource/bungee, @fontsource/archivo-black, js-yaml.

## Global Constraints

Copied verbatim from the spec; every task implicitly inherits these.

- **Engine repo:** `jamesj999/OpenGGF`, active branch `develop`.
- **Palette:** cobalt `#1A4FE6`, red `#E62B33`, signpost yellow `#FFD81F`, ink `#0E0E10`.
- **Fonts:** Bungee + Archivo Black, self-hosted woff2 (via Fontsource), `font-display: swap`.
- **Positioning copy:** lead with "Open-Source Sonic Engine"; tech line "OpenGL-accelerated, accurate engine written in Java"; parity is a supporting detail only.
- **Output:** fully static; zero JS shipped except where a component needs it. All motion gated behind `prefers-reduced-motion: reduce`.
- **Build command:** `astro build && pagefind --site dist`. Pages build is **read-only** (never commits).
- **GitHub fetch:** single shared build-time fetch; uses optional `GITHUB_TOKEN`; never fatal to the build — degrade per the §7 contract.
- **Literal fallback URLs:** downloads-no-data → `https://github.com/jamesj999/OpenGGF/releases/latest`; missing-asset / view-all → `https://github.com/jamesj999/OpenGGF/releases`.
- **Hero version source/fallback:** latest non-prerelease tag → latest prerelease marked `(pre)` → `SITE_FALLBACK_VERSION` → hide plate.
- **Doc sync source:** `--engine-path` arg → `$OPENGGF_ENGINE_PATH` → default `../sonic-engine`. CI never runs sync; it builds from the vendored copy.
- **Cache refresh:** only by the webzone refresh workflow / local `npm run refresh-cache`; commit message MUST NOT contain CI-skip directives; workflow needs `permissions: contents: write`.
- **Sega disclaimer** must appear in the footer.

---

## File Structure

```
openggf-webzone/
  package.json, astro.config.mjs, tsconfig.json, vitest.config.ts
  scripts/sync-docs.mjs           # T10: copy allowlisted docs from engine checkout
  scripts/refresh-cache.mjs       # T4:  write src/data/releases.cache.json
  .github/workflows/refresh-on-release.yml   # T14
  src/
    styles/tokens.css             # T1:  palette, fonts, base
    lib/releases.ts               # T4:  fetch + cache fallback + version + asset match
    lib/platforms.ts              # T4:  load download-platforms.yaml + match assets
    lib/motion.ts                 # T6:  prefers-reduced-motion guard
    components/ZigzagBand.astro    # T2
    components/ZigzagDivider.astro # T2
    components/ActPlateHeader.astro# T2
    components/NavBar.astro        # T3
    components/Footer.astro        # T3
    components/TitleCardHero.astro # T5
    components/SectionDownload.astro  # T7
    components/SectionReleases.astro  # T7
    components/SectionNews.astro      # T8
    components/SectionFaq.astro       # T8
    components/DocsSidebar.astro      # T11
    components/DocsTOC.astro          # T11
    layouts/BaseLayout.astro       # T3
    layouts/DocLayout.astro        # T11
    content/config.ts              # T8/T11: news + docs collections
    content/news/*.md              # T8: authored posts (one sample)
    content/docs/**                # T10: vendored (gitignored from manual edits? no, committed)
    data/faq.yaml                  # T8
    data/download-platforms.yaml   # T4
    data/releases.cache.json       # T4: committed fallback
    pages/index.astro              # T9
    pages/news/index.astro, pages/news/[...slug].astro, pages/rss.xml.ts  # T8
    pages/docs/index.astro         # T12
    pages/docs/[...slug].astro     # T11
  public/media/hero-poster.svg    # T5: placeholder poster
  public/fonts/                    # via Fontsource imports
  test/**                          # vitest specs mirror src
```

---

### Task 1: Project scaffold & design tokens

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/styles/tokens.css`
- Create: `src/pages/index.astro` (temporary smoke page, replaced in T9)
- Test: `test/build.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--ogf-blue|red|yellow|ink`, font families `--font-display` (Bungee), `--font-black` (Archivo Black); npm scripts `dev`, `build`, `test`, `sync-docs`, `refresh-cache`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "openggf-webzone",
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "build:astro": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "sync-docs": "node scripts/sync-docs.mjs",
    "refresh-cache": "node scripts/refresh-cache.mjs"
  },
  "dependencies": {
    "astro": "^4.15.0",
    "@astrojs/rss": "^4.0.7",
    "gsap": "^3.12.5",
    "@fontsource/bungee": "^5.0.0",
    "@fontsource/archivo-black": "^5.0.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "pagefind": "^1.1.0",
    "vitest": "^2.0.0",
    "@types/js-yaml": "^4.0.9"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://openggf.com',
  build: { format: 'directory' },
});
```

```json
// tsconfig.json
{ "extends": "astro/tsconfigs/strict", "include": ["src", "test", "scripts"] }
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['test/**/*.test.ts'] } });
```

- [ ] **Step 3: Create `src/styles/tokens.css`**

```css
@import '@fontsource/bungee/400.css';
@import '@fontsource/archivo-black/400.css';

:root {
  --ogf-blue: #1A4FE6;
  --ogf-red: #E62B33;
  --ogf-yellow: #FFD81F;
  --ogf-ink: #0E0E10;
  --ogf-paper: #f5f6fb;
  --font-display: 'Bungee', Impact, sans-serif;
  --font-black: 'Archivo Black', 'Arial Black', sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-family: var(--font-body); color: var(--ogf-ink); }
body { background: var(--ogf-paper); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 4: Create temporary `src/pages/index.astro`**

```astro
---
import '../styles/tokens.css';
---
<html lang="en"><head><meta charset="utf-8"><title>OpenGGF</title></head>
<body><h1 style="font-family:var(--font-display)">OpenGGF</h1></body></html>
```

- [ ] **Step 5: Write the failing build test** in `test/build.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('astro build', () => {
  it('produces dist/index.html', () => {
    execSync('npm run build:astro', { stdio: 'inherit' });
    expect(existsSync('dist/index.html')).toBe(true);
  });
});
```

- [ ] **Step 6: Run and verify it fails**

Run: `npm install && npx vitest run test/build.test.ts`
Expected: FAIL (build errors or missing dist) until deps install + files exist.

- [ ] **Step 7: Run again to verify pass**

Run: `npx vitest run test/build.test.ts`
Expected: PASS — `dist/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add package.json astro.config.mjs tsconfig.json vitest.config.ts src/styles/tokens.css src/pages/index.astro test/build.test.ts package-lock.json
git commit -m "feat: scaffold Astro project with Trace design tokens"
```

---

### Task 2: Design primitives (ZigzagBand, ZigzagDivider, ActPlateHeader)

**Files:**
- Create: `src/components/ZigzagBand.astro`, `src/components/ZigzagDivider.astro`, `src/components/ActPlateHeader.astro`
- Test: `test/components/primitives.test.ts`

**Interfaces:**
- Produces:
  - `ZigzagBand` props: `side: 'left'|'right'`, `color: string`, `width?: string` (default `25%`).
  - `ZigzagDivider` props: `color?: string` (default `var(--ogf-blue)`).
  - `ActPlateHeader` props: `label: string`, `accent?: string` (highlighted suffix word).

- [ ] **Step 1: Write the failing test** in `test/components/primitives.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ZigzagBand from '../../src/components/ZigzagBand.astro';
import ActPlateHeader from '../../src/components/ActPlateHeader.astro';

describe('primitives', () => {
  it('ZigzagBand left emits a clip-path polygon and the given color', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ZigzagBand, { props: { side: 'left', color: '#E62B33' } });
    expect(html).toContain('clip-path');
    expect(html).toContain('polygon');
    expect(html).toContain('#E62B33');
  });
  it('ActPlateHeader renders label text', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ActPlateHeader, { props: { label: 'Download' } });
    expect(html).toContain('Download');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/primitives.test.ts`
Expected: FAIL — components not found.

- [ ] **Step 3: Create `src/components/ZigzagBand.astro`**

```astro
---
interface Props { side: 'left' | 'right'; color: string; width?: string; }
const { side, color, width = '25%' } = Astro.props;
// Gentle teeth: step in ~10% over a tall pitch (8 steps), matching the deck polygon.
const left = 'polygon(0 0,100% 0,90% 12.5%,100% 25%,90% 37.5%,100% 50%,90% 62.5%,100% 75%,90% 87.5%,100% 100%,0 100%)';
const right = 'polygon(10% 0,100% 0,100% 100%,10% 100%,0 87.5%,10% 75%,0 62.5%,10% 50%,0 37.5%,10% 25%,0 12.5%)';
const clip = side === 'left' ? left : right;
---
<div class="band" data-side={side} style={`background:${color};width:${width};clip-path:${clip};${side === 'left' ? 'left:0' : 'right:0'};`}></div>
<style>
  .band { position: absolute; top: 0; bottom: 0; }
</style>
```

- [ ] **Step 4: Create `src/components/ZigzagDivider.astro`**

```astro
---
interface Props { color?: string; }
const { color = 'var(--ogf-blue)' } = Astro.props;
const clip = 'polygon(0 0,5% 100%,10% 0,15% 100%,20% 0,25% 100%,30% 0,35% 100%,40% 0,45% 100%,50% 0,55% 100%,60% 0,65% 100%,70% 0,75% 100%,80% 0,85% 100%,90% 0,95% 100%,100% 0)';
---
<div class="zig" style={`background:${color};clip-path:${clip};`}></div>
<style>.zig { height: 14px; width: 100%; }</style>
```

- [ ] **Step 5: Create `src/components/ActPlateHeader.astro`**

```astro
---
interface Props { label: string; accent?: string; }
const { label, accent } = Astro.props;
---
<h2 class="plate">{accent ? <>{label} <b>{accent}</b></> : label}</h2>
<style>
  .plate { display: inline-block; background: var(--ogf-ink); color: #fff;
    font: 900 clamp(15px,2.4vw,22px)/1 var(--font-body); text-transform: uppercase;
    letter-spacing: 1px; padding: 10px 20px; transform: skewX(-7deg); margin-bottom: 16px; }
  .plate b { color: var(--ogf-yellow); }
</style>
```

- [ ] **Step 6: Run test to verify pass**

Run: `npx vitest run test/components/primitives.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ZigzagBand.astro src/components/ZigzagDivider.astro src/components/ActPlateHeader.astro test/components/primitives.test.ts
git commit -m "feat: add zigzag band/divider and act-plate header primitives"
```

---

### Task 3: BaseLayout, NavBar, Footer

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/NavBar.astro`, `src/components/Footer.astro`
- Test: `test/components/chrome.test.ts`

**Interfaces:**
- Consumes: `tokens.css`.
- Produces:
  - `BaseLayout` props: `title: string`, `description?: string`; named `<slot/>`.
  - `NavBar` props: none; renders links Docs/Download/Releases/News/FAQ + search button (`#nav-search`) + GitHub link.
  - `Footer` props: none; renders the Sega disclaimer + GitHub link.

- [ ] **Step 1: Write the failing test** in `test/components/chrome.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NavBar from '../../src/components/NavBar.astro';
import Footer from '../../src/components/Footer.astro';

describe('chrome', () => {
  it('NavBar has all primary links and a search trigger', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(NavBar);
    for (const t of ['Docs', 'Download', 'Releases', 'News', 'FAQ', 'GitHub']) expect(html).toContain(t);
    expect(html).toContain('id="nav-search"');
    expect(html).toContain('github.com/jamesj999/OpenGGF');
  });
  it('Footer carries the Sega disclaimer', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Footer);
    expect(html).toContain('not affiliated with or endorsed by Sega');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/components/chrome.test.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Create `src/components/NavBar.astro`**

```astro
---
const links = [
  { href: '/docs', label: 'Docs' },
  { href: '/#download', label: 'Download' },
  { href: '/#releases', label: 'Releases' },
  { href: '/#news', label: 'News' },
  { href: '/#faq', label: 'FAQ' },
];
---
<nav class="nav">
  <a class="logo" href="/">OpenGGF</a>
  {links.map((l) => <a href={l.href}>{l.label}</a>)}
  <span class="sp"></span>
  <button id="nav-search" aria-label="Search docs">⌕ Search</button>
  <a class="gh" href="https://github.com/jamesj999/OpenGGF">GitHub ★</a>
</nav>
<style>
  .nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 16px;
    background: var(--ogf-ink); color: #fff; padding: 11px 20px; font: 800 13px var(--font-body); }
  .nav a { color: #cfd2ff; text-decoration: none; }
  .logo { font-family: var(--font-display); color: var(--ogf-yellow); letter-spacing: 1px; }
  .sp { flex: 1; }
  #nav-search { background: #2a2c44; color: #aeb2d6; border: none; border-radius: 6px;
    padding: 6px 12px; font: 700 12px var(--font-body); cursor: pointer; }
  .gh { background: var(--ogf-yellow); color: var(--ogf-ink); padding: 6px 12px; border-radius: 6px; }
</style>
```

- [ ] **Step 4: Create `src/components/Footer.astro`**

```astro
---
const year = 2026;
---
<footer class="foot">
  <p class="disc">OpenGGF is not affiliated with or endorsed by Sega. Sonic the Hedgehog and all
    related characters, names, and trademarks are the property of Sega Corporation. No ROM images or
    copyrighted game data are included. Users must supply their own legally obtained ROM files.</p>
  <p class="links">
    <a href="https://github.com/jamesj999/OpenGGF">GitHub</a> ·
    <a href="https://github.com/jamesj999/OpenGGF/blob/develop/LICENSE">License</a> ·
    <span>© {year} OpenGGF</span>
  </p>
</footer>
<style>
  .foot { background: var(--ogf-ink); color: #9aa0c0; padding: 28px 20px; font: 600 12px/1.6 var(--font-body); }
  .foot a { color: var(--ogf-yellow); }
  .disc { max-width: 70ch; margin-bottom: 10px; }
</style>
```

- [ ] **Step 5: Create `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/tokens.css';
import NavBar from '../components/NavBar.astro';
import Footer from '../components/Footer.astro';
interface Props { title: string; description?: string; }
const { title, description = 'OpenGGF — open-source, OpenGL-accelerated, accurate Sonic engine written in Java.' } = Astro.props;
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={description} />
</head>
<body>
  <NavBar />
  <main><slot /></main>
  <Footer />
</body>
</html>
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run test/components/chrome.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/NavBar.astro src/components/Footer.astro test/components/chrome.test.ts
git commit -m "feat: add BaseLayout, sticky NavBar, and Footer with Sega disclaimer"
```

---

### Task 4: GitHub releases data layer + cache refresh

**Files:**
- Create: `src/lib/releases.ts`, `src/lib/platforms.ts`
- Create: `src/data/download-platforms.yaml`, `src/data/releases.cache.json`
- Create: `scripts/refresh-cache.mjs`
- Test: `test/lib/releases.test.ts`, `test/lib/platforms.test.ts`

**Interfaces:**
- Produces:
  - Type `Release = { tag: string; name: string; url: string; prerelease: boolean; publishedAt: string; body: string; assets: { name: string; url: string }[] }`.
  - `selectHeroVersion(releases: Release[], fallback?: string): { label: string; isPre: boolean } | null` — null means hide the plate.
  - `getReleaseData(opts?: { token?: string; cache?: Release[] }): Promise<{ releases: Release[]; source: 'live'|'cache'|'none' }>`.
  - `matchAssets(release: Release | undefined, platforms: Platform[]): { platform: Platform; assetUrl: string | null }[]`.
  - `Platform = { id: string; label: string; icon: string; match: string }` from `loadPlatforms()`.

- [ ] **Step 1: Write failing tests** in `test/lib/releases.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectHeroVersion, getReleaseData, type Release } from '../../src/lib/releases';

const mk = (tag: string, pre = false): Release => ({
  tag, name: tag, url: `https://github.com/jamesj999/OpenGGF/releases/tag/${tag}`,
  prerelease: pre, publishedAt: '2026-06-01T00:00:00Z', body: '', assets: [],
});

afterEach(() => vi.unstubAllGlobals());

describe('selectHeroVersion', () => {
  it('prefers the latest non-prerelease', () => {
    expect(selectHeroVersion([mk('v0.6', true), mk('v0.5')])).toEqual({ label: 'v0.5', isPre: false });
  });
  it('falls back to prerelease marked (pre) when no stable exists', () => {
    expect(selectHeroVersion([mk('v0.6', true)])).toEqual({ label: 'v0.6 (pre)', isPre: true });
  });
  it('uses SITE_FALLBACK_VERSION string when no releases', () => {
    expect(selectHeroVersion([], 'v0.0')).toEqual({ label: 'v0.0', isPre: false });
  });
  it('returns null (hide plate) when nothing at all', () => {
    expect(selectHeroVersion([])).toBeNull();
  });
});

describe('getReleaseData', () => {
  it('uses live data on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ([{
      tag_name: 'v0.5', name: 'v0.5', html_url: 'u', prerelease: false,
      published_at: '2026-04-11T00:00:00Z', body: 'notes', assets: [{ name: 'a.jar', browser_download_url: 'd' }],
    }]) })));
    const r = await getReleaseData();
    expect(r.source).toBe('live');
    expect(r.releases[0].tag).toBe('v0.5');
    expect(r.releases[0].assets[0].url).toBe('d');
  });
  it('falls back to committed cache when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    const cache = [mk('v0.5')];
    const r = await getReleaseData({ cache });
    expect(r.source).toBe('cache');
    expect(r.releases[0].tag).toBe('v0.5');
  });
  it('reports none when fetch fails and no cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const r = await getReleaseData({ cache: [] });
    expect(r.source).toBe('none');
    expect(r.releases).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/lib/releases.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/releases.ts`**

```ts
export interface Release {
  tag: string; name: string; url: string; prerelease: boolean;
  publishedAt: string; body: string; assets: { name: string; url: string }[];
}
const API = 'https://api.github.com/repos/jamesj999/OpenGGF/releases?per_page=20';

function normalize(raw: any): Release {
  return {
    tag: raw.tag_name, name: raw.name || raw.tag_name, url: raw.html_url,
    prerelease: !!raw.prerelease, publishedAt: raw.published_at, body: raw.body || '',
    assets: (raw.assets || []).map((a: any) => ({ name: a.name, url: a.browser_download_url })),
  };
}

export async function getReleaseData(
  opts: { token?: string; cache?: Release[] } = {},
): Promise<{ releases: Release[]; source: 'live' | 'cache' | 'none' }> {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(API, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length) return { releases: data.map(normalize), source: 'live' };
    throw new Error('empty');
  } catch {
    if (opts.cache && opts.cache.length) return { releases: opts.cache, source: 'cache' };
    return { releases: [], source: 'none' };
  }
}

export function selectHeroVersion(
  releases: Release[], fallback?: string,
): { label: string; isPre: boolean } | null {
  const stable = releases.find((r) => !r.prerelease);
  if (stable) return { label: stable.tag, isPre: false };
  const pre = releases.find((r) => r.prerelease);
  if (pre) return { label: `${pre.tag} (pre)`, isPre: true };
  if (fallback) return { label: fallback, isPre: false };
  return null;
}
```

- [ ] **Step 4: Write failing test** in `test/lib/platforms.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { matchAssets, type Platform } from '../../src/lib/platforms';
import type { Release } from '../../src/lib/releases';

const platforms: Platform[] = [
  { id: 'win', label: 'Windows', icon: '🪟', match: 'windows|win|\\.exe' },
  { id: 'mac', label: 'macOS', icon: '🍎', match: 'mac|darwin|\\.dmg' },
];
const release: Release = {
  tag: 'v0.5', name: 'v0.5', url: 'u', prerelease: false, publishedAt: '', body: '',
  assets: [{ name: 'OpenGGF-windows.exe', url: 'win-url' }],
};

describe('matchAssets', () => {
  it('matches an asset to its platform by regex', () => {
    const r = matchAssets(release, platforms);
    expect(r.find((x) => x.platform.id === 'win')?.assetUrl).toBe('win-url');
  });
  it('returns null assetUrl for platforms with no match', () => {
    const r = matchAssets(release, platforms);
    expect(r.find((x) => x.platform.id === 'mac')?.assetUrl).toBeNull();
  });
  it('returns all-null when release is undefined', () => {
    const r = matchAssets(undefined, platforms);
    expect(r.every((x) => x.assetUrl === null)).toBe(true);
  });
});
```

- [ ] **Step 5: Create `src/lib/platforms.ts`**

```ts
import type { Release } from './releases';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export interface Platform { id: string; label: string; icon: string; match: string; }

export function loadPlatforms(): Platform[] {
  const p = fileURLToPath(new URL('../data/download-platforms.yaml', import.meta.url));
  return yaml.load(readFileSync(p, 'utf8')) as Platform[];
}

export function matchAssets(
  release: Release | undefined, platforms: Platform[],
): { platform: Platform; assetUrl: string | null }[] {
  return platforms.map((platform) => {
    if (!release) return { platform, assetUrl: null };
    const re = new RegExp(platform.match, 'i');
    const hit = release.assets.find((a) => re.test(a.name));
    return { platform, assetUrl: hit ? hit.url : null };
  });
}
```

- [ ] **Step 6: Create `src/data/download-platforms.yaml` and seed `src/data/releases.cache.json`**

```yaml
# src/data/download-platforms.yaml
- { id: win,   label: Windows, icon: "🪟", match: "windows|win|\\.exe|\\.msi" }
- { id: mac,   label: macOS,   icon: "🍎", match: "mac|darwin|\\.dmg|\\.pkg" }
- { id: linux, label: Linux,   icon: "🐧", match: "linux|\\.AppImage|\\.deb|\\.tar\\.gz" }
```

```json
[]
```

- [ ] **Step 7: Create `scripts/refresh-cache.mjs`**

```js
// Writes src/data/releases.cache.json from the live API. Run by the webzone
// refresh workflow or locally via `npm run refresh-cache`. Never run in the Pages build.
import { writeFileSync } from 'node:fs';
const API = 'https://api.github.com/repos/jamesj999/OpenGGF/releases?per_page=20';
const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const res = await fetch(API, { headers });
if (!res.ok) { console.error(`refresh-cache: GitHub API ${res.status}`); process.exit(1); }
const data = await res.json();
const norm = data.map((r) => ({
  tag: r.tag_name, name: r.name || r.tag_name, url: r.html_url, prerelease: !!r.prerelease,
  publishedAt: r.published_at, body: r.body || '',
  assets: (r.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url })),
}));
writeFileSync(new URL('../src/data/releases.cache.json', import.meta.url), JSON.stringify(norm, null, 2) + '\n');
console.log(`refresh-cache: wrote ${norm.length} releases`);
```

- [ ] **Step 8: Run tests to verify pass**

Run: `npx vitest run test/lib/releases.test.ts test/lib/platforms.test.ts`
Expected: PASS (all cases).

- [ ] **Step 9: Commit**

```bash
git add src/lib/releases.ts src/lib/platforms.ts src/data/download-platforms.yaml src/data/releases.cache.json scripts/refresh-cache.mjs test/lib/releases.test.ts test/lib/platforms.test.ts
git commit -m "feat: GitHub releases data layer with cache fallback + asset matching"
```

---

### Task 5: TitleCardHero

**Files:**
- Create: `src/components/TitleCardHero.astro`, `public/media/hero-poster.svg`
- Test: `test/components/hero.test.ts`

**Interfaces:**
- Consumes: `ZigzagBand` (T2), `selectHeroVersion` result shape (T4).
- Produces: `TitleCardHero` props: `version: { label: string; isPre: boolean } | null`, `videoSrc?: string`, `posterSrc?: string`.

- [ ] **Step 1: Write failing test** in `test/components/hero.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Hero from '../../src/components/TitleCardHero.astro';

describe('TitleCardHero', () => {
  it('renders wordmark, subtitle, two bands and the version plate', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: { label: 'v0.5', isPre: false } } });
    expect(html).toContain('OpenGGF');
    expect(html).toContain('Open-Source Sonic Engine');
    expect((html.match(/clip-path/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('v0.5');
  });
  it('hides the version plate when version is null', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: null } });
    expect(html).not.toContain('class="plate"');
  });
  it('renders the video WITHOUT autoplay (poster shows until JS opts in)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: null, videoSrc: '/media/hero.mp4' } });
    expect(html).toContain('hero-video');
    expect(html).toContain('poster=');
    expect(html).not.toContain('autoplay');   // reduced-motion users get the poster
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/components/hero.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Create `public/media/hero-poster.svg`** (placeholder until real video exists)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#1A4FE6"/></svg>
```

- [ ] **Step 4: Create `src/components/TitleCardHero.astro`**

```astro
---
import ZigzagBand from './ZigzagBand.astro';
interface Props { version: { label: string; isPre: boolean } | null; videoSrc?: string; posterSrc?: string; }
const { version, videoSrc, posterSrc = '/media/hero-poster.svg' } = Astro.props;
---
<section class="hero" data-hero>
  <ZigzagBand side="left" color="var(--ogf-red)" />
  <ZigzagBand side="right" color="var(--ogf-yellow)" />
  <div class="video" aria-hidden="true">
    {videoSrc
      ? <video class="hero-video" muted loop playsinline preload="none" poster={posterSrc}><source src={videoSrc} type="video/mp4" /></video>
      : <img src={posterSrc} alt="" />}
  </div>
  {version && (
    <div class="plate"><div class="z">VERSION</div><div class="a">{version.label}</div></div>
  )}
  <div class="center">
    <h1 class="wordmark">OpenGGF</h1>
    <p class="trace">Open-Source Sonic Engine</p>
    <p class="techline">OpenGL-accelerated · accurate · Java</p>
    <div class="ctas">
      <a class="btn p" href="/#download">⬇ Download</a>
      <a class="btn s" href="/docs">Read the docs</a>
    </div>
  </div>
</section>
<style>
  .hero { position: relative; min-height: 70vh; display: flex; align-items: center;
    justify-content: center; overflow: hidden; background: var(--ogf-blue); text-align: center; }
  .video { position: absolute; inset: 0; }
  .video video, .video img { width: 100%; height: 100%; object-fit: cover; opacity: .18; }
  .center { position: relative; z-index: 2; }
  .wordmark { font-family: var(--font-display); font-size: clamp(48px,10vw,110px); color: #fff;
    -webkit-text-stroke: 4px var(--ogf-ink); line-height: .9; }
  .trace { font-family: var(--font-black); font-style: italic; font-size: clamp(18px,3.5vw,30px);
    color: var(--ogf-yellow); -webkit-text-stroke: 1.5px var(--ogf-ink); transform: skewX(-6deg); margin-top: 8px; }
  .techline { display: inline-block; background: var(--ogf-ink); color: #fff; font: 800 13px var(--font-body);
    letter-spacing: 1px; padding: 7px 16px; margin-top: 14px; }
  .ctas { margin-top: 20px; display: flex; gap: 12px; justify-content: center; }
  .btn { font: 900 14px var(--font-body); padding: 12px 22px; border: 3px solid var(--ogf-ink);
    border-radius: 6px; text-decoration: none; }
  .btn.p { background: var(--ogf-yellow); color: var(--ogf-ink); }
  .btn.s { background: #fff; color: var(--ogf-ink); }
  .plate { position: absolute; top: 8%; right: 6%; z-index: 3; background: var(--ogf-yellow);
    border: 5px solid var(--ogf-ink); transform: rotate(-4deg); box-shadow: 6px 6px 0 rgba(14,14,16,.5); text-align: center; }
  .plate .z { font: 900 11px var(--font-body); letter-spacing: 1px; border-bottom: 4px solid var(--ogf-ink); padding: 5px 16px; }
  .plate .a { font: 900 22px var(--font-display); padding: 6px 16px; }
</style>
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/components/hero.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TitleCardHero.astro public/media/hero-poster.svg test/components/hero.test.ts
git commit -m "feat: title-card hero with zigzag bands, version plate, video slot"
```

---

### Task 6: Hero & scroll animations (GSAP, reduced-motion gated)

**Files:**
- Create: `src/lib/motion.ts`, `src/scripts/animate.ts`
- Modify: `src/components/TitleCardHero.astro` (add the client script import)
- Test: `test/lib/motion.test.ts`

**Interfaces:**
- Produces: `prefersReducedMotion(): boolean` (guards all animation entry points).

- [ ] **Step 1: Write failing test** in `test/lib/motion.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { prefersReducedMotion } from '../../src/lib/motion';

describe('prefersReducedMotion', () => {
  it('returns true when the media query matches', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(prefersReducedMotion()).toBe(true);
  });
  it('returns false when no window/matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/lib/motion.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/motion.ts`**

```ts
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 4: Create `src/scripts/animate.ts`** (the title-card "drop" + scroll reveals)

```ts
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../lib/motion';

export function initAnimations(): void {
  if (prefersReducedMotion()) return; // static render; hero video stays paused → poster shows
  gsap.registerPlugin(ScrollTrigger);

  // Motion allowed: opt the hero video into playback (markup omits `autoplay` so that
  // reduced-motion users never see it move — they keep the poster image).
  const heroVideo = document.querySelector<HTMLVideoElement>('.hero-video');
  if (heroVideo) { heroVideo.autoplay = true; heroVideo.play().catch(() => {}); }

  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const tl = gsap.timeline();
    tl.from(hero.querySelectorAll('.band'), { xPercent: (i) => (i === 0 ? -120 : 120), duration: .5, ease: 'power3.out' })
      .from(hero.querySelector('.plate'), { scale: 0, rotation: -20, duration: .35, ease: 'back.out(2)' }, '-=.15')
      .from(hero.querySelector('.wordmark'), { scale: 1.6, opacity: 0, duration: .35, ease: 'back.out(1.7)' }, '-=.2')
      .from(hero.querySelectorAll('.trace,.techline,.ctas'), { y: 20, opacity: 0, stagger: .08, duration: .3 }, '-=.1')
      .from(hero.querySelector('.video'), { opacity: 0, duration: .6 }, '-=.4');
  }

  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 40, opacity: 0, duration: .5, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 80%' } });
  });
}
document.addEventListener('DOMContentLoaded', initAnimations);
```

- [ ] **Step 5: Wire the script into the hero** — append to `src/components/TitleCardHero.astro` (after the `</style>`)

```astro
<script>
  import { initAnimations } from '../scripts/animate';
  // Astro bundles & runs this on the client. initAnimations self-guards on reduced motion.
  void initAnimations;
</script>
```

- [ ] **Step 6: Run unit test + build to verify**

Run: `npx vitest run test/lib/motion.test.ts && npm run build:astro`
Expected: PASS and a clean build (GSAP bundled, no SSR errors).

- [ ] **Step 7: Commit**

```bash
git add src/lib/motion.ts src/scripts/animate.ts src/components/TitleCardHero.astro test/lib/motion.test.ts
git commit -m "feat: GSAP title-card drop + scroll reveals, reduced-motion gated"
```

---

### Task 7: Homepage sections — Download & Releases (with degradation contract)

**Files:**
- Create: `src/components/SectionDownload.astro`, `src/components/SectionReleases.astro`
- Test: `test/components/download-releases.test.ts`

**Interfaces:**
- Consumes: `matchAssets`/`Platform` (T4), `Release` (T4), `ActPlateHeader` (T2).
- Produces:
  - `SectionDownload` props: `matches: { platform: Platform; assetUrl: string | null }[]`, `hasData: boolean`.
  - `SectionReleases` props: `releases: Release[]`.

- [ ] **Step 1: Write failing tests** in `test/components/download-releases.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Download from '../../src/components/SectionDownload.astro';
import Releases from '../../src/components/SectionReleases.astro';

const plat = { id: 'win', label: 'Windows', icon: '🪟', match: 'win' };

describe('SectionDownload', () => {
  it('renders per-OS button when asset present', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Download, { props: { hasData: true,
      matches: [{ platform: plat, assetUrl: 'win-url' }] } });
    expect(html).toContain('win-url');
    expect(html).toContain('Windows');
  });
  it('missing asset links to the releases page', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Download, { props: { hasData: true,
      matches: [{ platform: plat, assetUrl: null }] } });
    expect(html).toContain('https://github.com/jamesj999/OpenGGF/releases');
  });
  it('no data → single Download-from-GitHub CTA to /releases/latest', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Download, { props: { hasData: false, matches: [] } });
    expect(html).toContain('https://github.com/jamesj999/OpenGGF/releases/latest');
    expect(html).toContain('Download from GitHub');
  });
});

describe('SectionReleases', () => {
  it('lists releases when present', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Releases, { props: { releases: [
      { tag: 'v0.5', name: 'v0.5', url: 'u', prerelease: false, publishedAt: '2026-04-11T00:00:00Z', body: 'x', assets: [] }] } });
    expect(html).toContain('v0.5');
  });
  it('empty → View all releases link-out', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Releases, { props: { releases: [] } });
    expect(html).toContain('View all releases on GitHub');
    expect(html).toContain('https://github.com/jamesj999/OpenGGF/releases');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/components/download-releases.test.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Create `src/components/SectionDownload.astro`**

```astro
---
import ActPlateHeader from './ActPlateHeader.astro';
import type { Platform } from '../lib/platforms';
interface Props { matches: { platform: Platform; assetUrl: string | null }[]; hasData: boolean; }
const { matches, hasData } = Astro.props;
const RELEASES = 'https://github.com/jamesj999/OpenGGF/releases';
const LATEST = 'https://github.com/jamesj999/OpenGGF/releases/latest';
---
<section id="download" class="sec" data-reveal>
  <ActPlateHeader label="⬇" accent="Download" />
  {hasData ? (
    <div class="grid">
      {matches.map(({ platform, assetUrl }) => (
        <a class="dl" href={assetUrl ?? RELEASES}>
          <span class="icon">{platform.icon}</span>{platform.label}
          {!assetUrl && <span class="note">find your build</span>}
        </a>
      ))}
    </div>
  ) : (
    <a class="dl single" href={LATEST}>⬇ Download from GitHub →</a>
  )}
  <p class="req">Requires a legally-obtained ROM. JDK 21+.</p>
</section>
<style>
  .sec { padding: 48px 20px; max-width: 1000px; margin: 0 auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 12px; }
  .dl { display: flex; flex-direction: column; align-items: center; gap: 4px; background: var(--ogf-red);
    color: #fff; border: 3px solid var(--ogf-ink); border-radius: 8px; padding: 18px; font: 900 14px var(--font-body);
    text-decoration: none; }
  .dl .icon { font-size: 24px; }
  .dl .note { font: 700 10px var(--font-body); opacity: .85; }
  .dl.single { background: var(--ogf-ink); }
  .req { margin-top: 12px; font: 600 12px var(--font-body); color: #888; }
</style>
```

- [ ] **Step 4: Create `src/components/SectionReleases.astro`**

```astro
---
import ActPlateHeader from './ActPlateHeader.astro';
import type { Release } from '../lib/releases';
interface Props { releases: Release[]; }
const { releases } = Astro.props;
const RELEASES = 'https://github.com/jamesj999/OpenGGF/releases';
const fmt = (d: string) => (d ? new Date(d).toISOString().slice(0, 7) : '');
---
<section id="releases" class="sec" data-reveal>
  <ActPlateHeader label="Releases" />
  {releases.length ? (
    <>
      <ul class="list">
        {releases.slice(0, 6).map((r) => (
          <li class="rel">
            <a class="tag" href={r.url}>{r.tag}{r.prerelease ? ' (pre)' : ''}</a>
            <span class="date">{fmt(r.publishedAt)}</span>
          </li>
        ))}
      </ul>
      <a class="all" href={RELEASES}>All releases →</a>
    </>
  ) : (
    <a class="linkout" href={RELEASES}>View all releases on GitHub →</a>
  )}
</section>
<style>
  .sec { padding: 48px 20px; max-width: 1000px; margin: 0 auto; background: #fff; }
  .list { list-style: none; }
  .rel { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #eef0f7; padding: 10px 0; }
  .tag { background: var(--ogf-yellow); border: 2px solid var(--ogf-ink); border-radius: 4px;
    font: 900 12px var(--font-body); padding: 3px 10px; text-decoration: none; color: var(--ogf-ink); }
  .date { color: #888; font: 700 12px var(--font-body); }
  .all, .linkout { display: inline-block; margin-top: 12px; font: 800 13px var(--font-body); color: var(--ogf-blue); }
</style>
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/components/download-releases.test.ts`
Expected: PASS (all degradation cases).

- [ ] **Step 6: Commit**

```bash
git add src/components/SectionDownload.astro src/components/SectionReleases.astro test/components/download-releases.test.ts
git commit -m "feat: Download & Releases sections with full degradation contract"
```

---

### Task 8: Homepage sections — News & FAQ (collections, RSS)

**Files:**
- Create: `src/content/config.ts`, `src/content/news/2026-06-18-hello.md`, `src/data/faq.yaml`
- Create: `src/components/SectionNews.astro`, `src/components/SectionFaq.astro`
- Create: `src/pages/news/index.astro`, `src/pages/news/[...slug].astro`, `src/pages/rss.xml.ts`
- Test: `test/components/news-faq.test.ts`

**Interfaces:**
- Consumes: `ActPlateHeader` (T2). Defines the `news` content collection.
- Produces: `SectionNews` props: `posts: { slug: string; data: { title: string; date: Date; summary: string } }[]`. `SectionFaq` props: `items: { q: string; a: string }[]`.

- [ ] **Step 1: Write failing tests** in `test/components/news-faq.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import News from '../../src/components/SectionNews.astro';
import Faq from '../../src/components/SectionFaq.astro';

describe('SectionNews', () => {
  it('renders a card per post with a permalink', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(News, { props: { posts: [
      { slug: 'hello', data: { title: 'Hello', date: new Date('2026-06-18'), summary: 'First post' } }] } });
    expect(html).toContain('Hello');
    expect(html).toContain('/news/hello');
  });
});
describe('SectionFaq', () => {
  it('renders each Q as a details/summary accordion', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Faq, { props: { items: [{ q: 'Do I need a ROM?', a: 'Yes.' }] } });
    expect(html).toContain('<details');
    expect(html).toContain('Do I need a ROM?');
    expect(html).toContain('Yes.');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/components/news-faq.test.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Create `src/content/config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
const news = defineCollection({
  type: 'content',
  schema: z.object({ title: z.string(), date: z.date(), summary: z.string(), image: z.string().optional() }),
});
const docs = defineCollection({
  type: 'content',
  schema: z.object({ title: z.string(), group: z.string(), order: z.number().default(99) }),
});
export const collections = { news, docs };
```

- [ ] **Step 4: Create sample post `src/content/news/2026-06-18-hello.md` and `src/data/faq.yaml`**

```markdown
---
title: "OpenGGF gets a website"
date: 2026-06-18
summary: "The new openggf.com is live — downloads, releases, and docs in one place."
---

Welcome to the new home of OpenGGF.
```

```yaml
# src/data/faq.yaml
- q: "Do I need a ROM?"
  a: "Yes — OpenGGF requires a legally-obtained ROM image. None are distributed with the engine."
- q: "Which games are supported?"
  a: "The mainline 16-bit Sonic titles: Sonic 1, Sonic 2, and Sonic 3 & Knuckles."
- q: "Is this affiliated with Sega?"
  a: "No. OpenGGF is an independent open-source project, not affiliated with or endorsed by Sega."
```

- [ ] **Step 5: Create `src/components/SectionNews.astro`**

```astro
---
import ActPlateHeader from './ActPlateHeader.astro';
interface Props { posts: { slug: string; data: { title: string; date: Date; summary: string } }[]; }
const { posts } = Astro.props;
---
<section id="news" class="sec" data-reveal>
  <ActPlateHeader label="News" />
  <div class="grid">
    {posts.slice(0, 4).map((p) => (
      <a class="card" href={`/news/${p.slug}`}>
        <time>{p.data.date.toISOString().slice(0, 10)}</time>
        <h3>{p.data.title}</h3>
        <p>{p.data.summary}</p>
      </a>
    ))}
  </div>
  <a class="all" href="/news">All news →</a>
</section>
<style>
  .sec { padding: 48px 20px; max-width: 1000px; margin: 0 auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 14px; }
  .card { display: block; background: #fff; border: 3px solid var(--ogf-ink); border-radius: 8px;
    padding: 16px; text-decoration: none; color: var(--ogf-ink); }
  .card time { font: 700 11px var(--font-body); color: var(--ogf-blue); }
  .card h3 { font: 900 16px var(--font-body); margin: 6px 0; }
  .card p { font: 400 13px/1.5 var(--font-body); color: #555; }
  .all { display: inline-block; margin-top: 12px; font: 800 13px var(--font-body); color: var(--ogf-blue); }
</style>
```

- [ ] **Step 6: Create `src/components/SectionFaq.astro`**

```astro
---
import ActPlateHeader from './ActPlateHeader.astro';
interface Props { items: { q: string; a: string }[]; }
const { items } = Astro.props;
---
<section id="faq" class="sec" data-reveal>
  <ActPlateHeader label="FAQ" />
  {items.map((it) => (
    <details class="faq">
      <summary>{it.q}</summary>
      <p>{it.a}</p>
    </details>
  ))}
</section>
<style>
  .sec { padding: 48px 20px; max-width: 800px; margin: 0 auto; background: #fff; }
  .faq { border-bottom: 2px solid #eef0f7; padding: 12px 0; }
  .faq summary { font: 800 14px var(--font-body); cursor: pointer; list-style: none; }
  .faq summary::after { content: ' ＋'; color: var(--ogf-blue); }
  .faq[open] summary::after { content: ' －'; }
  .faq p { font: 400 13px/1.6 var(--font-body); color: #555; margin-top: 8px; }
</style>
```

- [ ] **Step 7: Create news pages + RSS**

```astro
---
// src/pages/news/index.astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
const posts = (await getCollection('news')).sort((a, b) => +b.data.date - +a.data.date);
---
<BaseLayout title="News — OpenGGF">
  <section style="max-width:800px;margin:0 auto;padding:48px 20px">
    <h1 style="font-family:var(--font-display)">News</h1>
    {posts.map((p) => (
      <article style="margin:18px 0">
        <a href={`/news/${p.slug}`} style="font:900 18px var(--font-body);color:var(--ogf-ink);text-decoration:none">{p.data.title}</a>
        <p style="color:#888;font:600 12px var(--font-body)">{p.data.date.toISOString().slice(0,10)}</p>
      </article>
    ))}
  </section>
</BaseLayout>
```

```astro
---
// src/pages/news/[...slug].astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
export async function getStaticPaths() {
  const posts = await getCollection('news');
  return posts.map((p) => ({ params: { slug: p.slug }, props: { post: p } }));
}
const { post } = Astro.props;
const { Content } = await post.render();
---
<BaseLayout title={`${post.data.title} — OpenGGF`} description={post.data.summary}>
  <article style="max-width:760px;margin:0 auto;padding:48px 20px">
    <h1 style="font-family:var(--font-display)">{post.data.title}</h1>
    <p style="color:#888">{post.data.date.toISOString().slice(0,10)}</p>
    <Content />
  </article>
</BaseLayout>
```

```ts
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
export async function GET(context: { site: string }) {
  const posts = await getCollection('news');
  return rss({
    title: 'OpenGGF News', description: 'Updates from the OpenGGF project',
    site: context.site,
    items: posts.map((p) => ({ title: p.data.title, pubDate: p.data.date,
      description: p.data.summary, link: `/news/${p.slug}/` })),
  });
}
```

- [ ] **Step 8: Run tests + build to verify**

Run: `npx vitest run test/components/news-faq.test.ts && npm run build:astro`
Expected: PASS and clean build (collections compile, `/rss.xml` and news pages emit).

- [ ] **Step 9: Commit**

```bash
git add src/content/config.ts src/content/news src/data/faq.yaml src/components/SectionNews.astro src/components/SectionFaq.astro src/pages/news src/pages/rss.xml.ts test/components/news-faq.test.ts
git commit -m "feat: News (collection+RSS) and FAQ sections"
```

---

### Task 9: Homepage assembly

**Files:**
- Modify/replace: `src/pages/index.astro`
- Test: `test/pages/homepage.test.ts`

**Interfaces:**
- Consumes: all of T2–T8 (BaseLayout, TitleCardHero, ZigzagDivider, SectionDownload/Releases/News/Faq, releases lib).

- [ ] **Step 1: Write failing test** in `test/pages/homepage.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

describe('homepage build', () => {
  it('renders hero + all four sections in order', () => {
    execSync('npm run build:astro', { stdio: 'inherit' });
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).toContain('OpenGGF');
    const order = ['id="download"', 'id="releases"', 'id="news"', 'id="faq"'];
    let last = -1;
    for (const id of order) { const i = html.indexOf(id); expect(i).toBeGreaterThan(last); last = i; }
    expect(existsSync('dist/rss.xml')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/pages/homepage.test.ts`
Expected: FAIL — index.astro still the smoke page.

- [ ] **Step 3: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import TitleCardHero from '../components/TitleCardHero.astro';
import ZigzagDivider from '../components/ZigzagDivider.astro';
import SectionDownload from '../components/SectionDownload.astro';
import SectionReleases from '../components/SectionReleases.astro';
import SectionNews from '../components/SectionNews.astro';
import SectionFaq from '../components/SectionFaq.astro';
import { getReleaseData, selectHeroVersion, type Release } from '../lib/releases';
import { loadPlatforms, matchAssets } from '../lib/platforms';
import { getCollection } from 'astro:content';
import cache from '../data/releases.cache.json';
import faq from '../data/faq.yaml';

// Build-time-injected per the spec (set SITE_FALLBACK_VERSION in the Pages env / .env);
// the literal 'v0.5' is the documented default for local/dev builds only.
const SITE_FALLBACK_VERSION = import.meta.env.SITE_FALLBACK_VERSION ?? 'v0.5';
const { releases, source } = await getReleaseData({ token: import.meta.env.GITHUB_TOKEN, cache: cache as Release[] });
const hasData = source !== 'none';
const version = selectHeroVersion(releases, SITE_FALLBACK_VERSION);
const matches = matchAssets(releases[0], loadPlatforms());
const posts = (await getCollection('news')).sort((a, b) => +b.data.date - +a.data.date)
  .map((p) => ({ slug: p.slug, data: p.data }));
const faqItems = faq as { q: string; a: string }[];
---
<BaseLayout title="OpenGGF — Open-Source Sonic Engine">
  <TitleCardHero version={version} />
  <ZigzagDivider />
  <SectionDownload matches={matches} hasData={hasData} />
  <SectionReleases releases={releases} />
  <SectionNews posts={posts} />
  <SectionFaq items={faqItems} />
</BaseLayout>
```

- [ ] **Step 4: Enable YAML imports** — add to `astro.config.mjs` a vite plugin or use `@rollup/plugin-yaml`. Simplest: install `@rollup/plugin-yaml` and register it.

Modify `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import yaml from '@rollup/plugin-yaml';
export default defineConfig({
  site: 'https://openggf.com',
  build: { format: 'directory' },
  vite: { plugins: [yaml()] },
});
```

Add dep: `npm i -D @rollup/plugin-yaml`

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/pages/homepage.test.ts`
Expected: PASS — sections present in order, rss.xml emitted.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro astro.config.mjs package.json package-lock.json test/pages/homepage.test.ts
git commit -m "feat: assemble homepage (hero + download/releases/news/faq)"
```

---

### Task 10: Doc sync script

**Files:**
- Create: `scripts/sync-docs.mjs`
- Create: `test/scripts/fixtures/engine/` (fixture mini-repo) + `test/scripts/sync-docs.test.ts`

**Interfaces:**
- Produces: CLI `node scripts/sync-docs.mjs [--engine-path <dir>] [--out-dir <dir>]`; copies the allowlist into the out dir (default `src/content/docs/`), normalizes frontmatter (`title`, `group`, `order`), rewrites relative `.md` links to site `/docs/...` paths. Exit non-zero with the spec's message when the path is invalid. (`--out-dir` exists so tests run against a temp dir and never dirty the tracked vendored docs.)

- [ ] **Step 1: Create fixtures** under `test/scripts/fixtures/engine/`

```
test/scripts/fixtures/engine/docs/guide/playing/getting-started.md
test/scripts/fixtures/engine/docs/guide/index.md
```

`getting-started.md`:
```markdown
# Getting Started
See [controls](./controls.md).
```

`index.md`:
```markdown
# Guide
```

(Note: the fixture has no `.git`; the script's git-repo check must treat a directory containing `docs/guide/` as valid — see Step 3 validation.)

- [ ] **Step 2: Write failing tests** in `test/scripts/sync-docs.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'test/scripts/fixtures/engine');
let OUT: string;   // temp output dir per test — never the tracked src/content/docs

describe('sync-docs', () => {
  beforeEach(() => { OUT = mkdtempSync(join(tmpdir(), 'docs-out-')); });
  afterEach(() => { rmSync(OUT, { recursive: true, force: true }); });

  it('copies allowlisted guide docs and adds frontmatter', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { stdio: 'inherit' });
    const out = join(OUT, 'guide/playing/getting-started.md');
    expect(existsSync(out)).toBe(true);
    const txt = readFileSync(out, 'utf8');
    expect(txt).toMatch(/^---/);              // frontmatter added
    expect(txt).toContain('title:');
    expect(txt).toContain('/docs/guide/playing/controls');  // link rewritten
  });

  it('exits non-zero with a clear message when path is invalid', () => {
    const bad = mkdtempSync(join(tmpdir(), 'empty-'));
    let code = 0, msg = '';
    try { execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', bad, '--out-dir', OUT], { encoding: 'utf8' }); }
    catch (e: any) { code = e.status; msg = (e.stderr || '') + (e.stdout || ''); }
    expect(code).not.toBe(0);
    expect(msg).toContain('engine repo not found');
  });

  it('prunes stale output that is no longer in the source', () => {
    // Seed a stale file that the fixture does NOT produce.
    mkdirSync(join(OUT, 'guide/old'), { recursive: true });
    writeFileSync(join(OUT, 'guide/old/removed.md'), '---\ntitle: "Old"\n---\nstale');
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { stdio: 'inherit' });
    expect(existsSync(join(OUT, 'guide/old/removed.md'))).toBe(false);   // pruned
    expect(existsSync(join(OUT, 'guide/playing/getting-started.md'))).toBe(true); // re-synced
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run test/scripts/sync-docs.test.ts`
Expected: FAIL — script missing.

- [ ] **Step 4: Create `scripts/sync-docs.mjs`**

```js
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }
const enginePath = resolve(arg('--engine-path') || process.env.OPENGGF_ENGINE_PATH || '../sonic-engine');
const OUT = resolve(arg('--out-dir') || 'src/content/docs');   // overridable so tests never touch the tracked dir

// Validation: directory must exist and look like the engine (has docs/guide/).
if (!existsSync(enginePath) || !existsSync(join(enginePath, 'docs/guide'))) {
  console.error(`sync-docs: engine repo not found at "${enginePath}". ` +
    `Pass --engine-path or set OPENGGF_ENGINE_PATH.`);
  process.exit(1);
}

// Soft branch check (spec: log + warn, never fail). Skips silently when not a git
// checkout (e.g. test fixtures) or when a release tag is checked out deliberately.
try {
  const { execFileSync } = await import('node:child_process');
  const branch = execFileSync('git', ['-C', enginePath, 'rev-parse', '--abbrev-ref', 'HEAD'],
    { encoding: 'utf8' }).trim();
  console.log(`sync-docs: engine branch "${branch}"`);
  if (branch && branch !== 'develop' && branch !== 'HEAD') {
    console.warn(`sync-docs: expected branch "develop" but found "${branch}" — syncing anyway.`);
  }
} catch { /* not a git repo / git unavailable — skip the check */ }

// Allowlist: globs of public dirs/files (paths relative to engine root).
const ALLOW_DIRS = ['docs/guide'];
const ALLOW_FILES = ['CONFIGURATION.md', 'ROADMAP.md', 'CREDITS.md', 'CONTRIBUTING.md'];

const groupFor = (rel) => {
  if (rel.includes('/playing/')) return 'Players';
  if (rel.includes('/contributing/')) return 'Contributors';
  if (rel.includes('/cross-referencing/')) return 'Cross-referencing';
  return 'Reference';
};
const titleFor = (txt, rel) => {
  const h1 = txt.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : rel.split('/').pop().replace(/\.md$/, '');
};
// Rewrite ./foo.md and ../bar/baz.md links to /docs/... slugs.
const rewriteLinks = (txt, relDir) => txt.replace(/\]\((\.[^)]+?)\.md(#[^)]*)?\)/g, (_, p, hash) => {
  const target = resolve('/docs', relDir, p).replace(/\\/g, '/');
  return `](${target}${hash || ''})`;
});

function copyMd(absSrc, relFromEngine) {
  // Map engine path to docs slug: strip leading "docs/" for guide files.
  const slug = relFromEngine.replace(/^docs\//, '');
  const dest = join(OUT, slug);
  const raw = readFileSync(absSrc, 'utf8');
  const title = titleFor(raw, slug);
  const group = groupFor('/' + slug);
  const body = rewriteLinks(raw, dirname(slug));
  const fm = `---\ntitle: ${JSON.stringify(title)}\ngroup: ${JSON.stringify(group)}\norder: 99\n---\n\n`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, fm + body);
}

function walk(absDir, relDir) {
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    const rel = join(relDir, name).replace(/\\/g, '/');
    if (statSync(abs).isDirectory()) walk(abs, rel);
    else if (name.endsWith('.md')) copyMd(abs, rel);
  }
}

// Prune stale output: regenerate the vendored docs from scratch each run so deleted,
// renamed, or newly-excluded files never linger in the published site.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const d of ALLOW_DIRS) { const abs = join(enginePath, d); if (existsSync(abs)) { walk(abs, d); } }
for (const f of ALLOW_FILES) {
  const abs = join(enginePath, f);
  if (existsSync(abs)) copyMd(abs, 'docs/reference/' + f.toLowerCase().replace(/\.md$/, '') + '.md');
}
console.log(`sync-docs: synced from ${enginePath}`);
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/scripts/sync-docs.test.ts`
Expected: PASS (copy + frontmatter + link rewrite, and the validation-failure case).

- [ ] **Step 6: Run the real sync against the local engine checkout**

Run: `npm run sync-docs`
Expected: `sync-docs: synced from .../sonic-engine`; files appear under `src/content/docs/`.

- [ ] **Step 7: Commit**

```bash
git add scripts/sync-docs.mjs test/scripts/fixtures test/scripts/sync-docs.test.ts src/content/docs
git commit -m "feat: doc sync script (allowlist, frontmatter, link rewrite) + vendored docs"
```

---

### Task 11: Docs collection rendering — DocLayout, sidebar, TOC, doc pages

**Files:**
- Create: `src/components/DocsSidebar.astro`, `src/components/DocsTOC.astro`, `src/layouts/DocLayout.astro`
- Create: `src/pages/docs/[...slug].astro`
- Test: `test/components/docs.test.ts`

**Interfaces:**
- Consumes: `docs` collection (T8 config), `BaseLayout` (T3).
- Produces:
  - `DocsSidebar` props: `groups: { name: string; items: { title: string; slug: string }[] }[]`, `current: string`.
  - `DocsTOC` props: `headings: { depth: number; slug: string; text: string }[]`.
  - `DocLayout` props: `title`, `group`, `groups`, `current`, `headings`.

- [ ] **Step 1: Write failing tests** in `test/components/docs.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import DocsSidebar from '../../src/components/DocsSidebar.astro';
import DocsTOC from '../../src/components/DocsTOC.astro';

describe('docs nav', () => {
  it('sidebar groups items and marks current', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(DocsSidebar, { props: {
      current: 'guide/playing/controls',
      groups: [{ name: 'Players', items: [{ title: 'Controls', slug: 'guide/playing/controls' }] }] } });
    expect(html).toContain('Players');
    expect(html).toContain('Controls');
    expect(html).toContain('aria-current="page"');
  });
  it('TOC lists headings', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(DocsTOC, { props: {
      headings: [{ depth: 2, slug: 'config', text: 'Config file' }] } });
    expect(html).toContain('Config file');
    expect(html).toContain('#config');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/components/docs.test.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Create `src/components/DocsSidebar.astro`**

```astro
---
interface Props { groups: { name: string; items: { title: string; slug: string }[] }[]; current: string; }
const { groups, current } = Astro.props;
---
<nav class="side">
  {groups.map((g) => (
    <div class="grp-block">
      <p class="grp">{g.name}</p>
      <ul>
        {g.items.map((it) => (
          <li><a href={`/docs/${it.slug}`} aria-current={it.slug === current ? 'page' : undefined}
            class={it.slug === current ? 'on' : ''}>{it.title}</a></li>
        ))}
      </ul>
    </div>
  ))}
</nav>
<style>
  .side { padding: 16px 10px; }
  .grp { font: 900 10px var(--font-body); text-transform: uppercase; letter-spacing: 1px;
    color: var(--ogf-blue); margin: 14px 6px 6px; }
  .side ul { list-style: none; }
  .side a { display: block; padding: 5px 10px; border-radius: 5px; color: #333;
    font: 600 13px var(--font-body); text-decoration: none; }
  .side a.on { background: var(--ogf-blue); color: #fff; font-weight: 800; }
</style>
```

- [ ] **Step 4: Create `src/components/DocsTOC.astro`**

```astro
---
interface Props { headings: { depth: number; slug: string; text: string }[]; }
const { headings } = Astro.props;
const items = headings.filter((h) => h.depth === 2 || h.depth === 3);
---
{items.length > 0 && (
  <nav class="toc">
    <p class="t">On this page</p>
    {items.map((h) => <a href={`#${h.slug}`} style={`padding-left:${(h.depth - 2) * 10}px`}>{h.text}</a>)}
  </nav>
)}
<style>
  .toc { font: 600 12px var(--font-body); }
  .t { color: var(--ogf-blue); font-weight: 900; text-transform: uppercase; font-size: 10px; margin-bottom: 8px; }
  .toc a { display: block; padding: 3px 0; color: #888; text-decoration: none; }
</style>
```

- [ ] **Step 5: Create `src/layouts/DocLayout.astro`**

```astro
---
import BaseLayout from './BaseLayout.astro';
import DocsSidebar from '../components/DocsSidebar.astro';
import DocsTOC from '../components/DocsTOC.astro';
interface Props {
  title: string; group: string; current: string;
  groups: { name: string; items: { title: string; slug: string }[] }[];
  headings: { depth: number; slug: string; text: string }[];
}
const { title, group, current, groups, headings } = Astro.props;
---
<BaseLayout title={`${title} — OpenGGF Docs`}>
  <div class="layout">
    <aside class="l"><DocsSidebar groups={groups} current={current} /></aside>
    <article class="m">
      <p class="crumb">Docs › {group}</p>
      <h2 class="tag">{group}</h2>
      <h1>{title}</h1>
      <div class="prose"><slot /></div>
    </article>
    <aside class="r"><DocsTOC headings={headings} /></aside>
  </div>
</BaseLayout>
<style>
  .layout { display: grid; grid-template-columns: 220px 1fr 180px; max-width: 1200px; margin: 0 auto; min-height: 70vh; }
  .l { border-right: 2px solid #ececf3; background: var(--ogf-paper); }
  .r { border-left: 2px solid #ececf3; padding: 22px 14px; }
  .m { padding: 28px 32px; }
  .crumb { font: 700 11px var(--font-body); color: #999; }
  .tag { display: inline-block; background: var(--ogf-ink); color: #fff; font: 900 11px var(--font-body);
    padding: 5px 12px; transform: skewX(-7deg); margin: 8px 0; }
  .m h1 { font-family: var(--font-display); font-size: 30px; margin-bottom: 14px; }
  .prose :global(h2) { font-family: var(--font-display); font-size: 20px; margin: 22px 0 10px; }
  .prose :global(pre) { background: var(--ogf-ink); color: #d6e0ff; padding: 14px; border-radius: 8px;
    border-left: 5px solid var(--ogf-yellow); overflow-x: auto; margin: 12px 0; }
  .prose :global(p) { font: 400 14px/1.7 var(--font-body); color: #444; margin: 10px 0; }
  @media (max-width: 880px) { .layout { grid-template-columns: 1fr; } .l, .r { border: none; } }
</style>
```

- [ ] **Step 6: Create `src/pages/docs/[...slug].astro`**

```astro
---
import DocLayout from '../../layouts/DocLayout.astro';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  const groups = buildGroups(docs);
  return docs.map((d) => ({ params: { slug: d.slug }, props: { doc: d, groups } }));
}
function buildGroups(docs: any[]) {
  const order = ['Players', 'Contributors', 'Cross-referencing', 'Reference'];
  const map = new Map<string, { title: string; slug: string }[]>();
  for (const d of docs.sort((a, b) => a.data.order - b.data.order)) {
    const g = d.data.group;
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push({ title: d.data.title, slug: d.slug });
  }
  return order.filter((g) => map.has(g)).map((name) => ({ name, items: map.get(name)! }));
}
const { doc, groups } = Astro.props;
const { Content, headings } = await doc.render();
---
<DocLayout title={doc.data.title} group={doc.data.group} current={doc.slug}
  groups={groups} headings={headings}>
  <Content />
</DocLayout>
```

- [ ] **Step 7: Run tests + build to verify**

Run: `npx vitest run test/components/docs.test.ts && npm run build:astro`
Expected: PASS and a build that emits `dist/docs/.../index.html` for each vendored doc.

- [ ] **Step 8: Commit**

```bash
git add src/components/DocsSidebar.astro src/components/DocsTOC.astro src/layouts/DocLayout.astro src/pages/docs/[...slug].astro test/components/docs.test.ts
git commit -m "feat: docs rendering — sidebar, TOC, DocLayout, dynamic doc pages"
```

---

### Task 12: Docs hub landing page

**Files:**
- Create: `src/pages/docs/index.astro`
- Test: `test/pages/docs-hub.test.ts`

**Interfaces:**
- Consumes: `BaseLayout` (T3).

- [ ] **Step 1: Write failing test** in `test/pages/docs-hub.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('docs hub', () => {
  it('shows Play / Contribute / Cross-reference cards', () => {
    execSync('npm run build:astro', { stdio: 'inherit' });
    const html = readFileSync('dist/docs/index.html', 'utf8');
    for (const t of ['Play', 'Contribute', 'Cross-reference']) expect(html).toContain(t);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/pages/docs-hub.test.ts`
Expected: FAIL — page missing.

- [ ] **Step 3: Create `src/pages/docs/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
// Derive each card's link from the synced docs collection (first doc per group by order),
// so the hub can never ship a hard-coded slug that the sync didn't produce. Groups with no
// synced docs are dropped rather than rendered as broken links.
const docs = await getCollection('docs');
const firstIn = (group: string) =>
  docs.filter((d) => d.data.group === group).sort((a, b) => a.data.order - b.data.order)[0];
const defs = [
  { group: 'Players', title: 'Play', desc: 'Install, configure, and run the engine.', color: 'var(--ogf-red)' },
  { group: 'Contributors', title: 'Contribute', desc: 'Dev setup, architecture, adding zones & bosses.', color: 'var(--ogf-blue)' },
  { group: 'Cross-referencing', title: 'Cross-reference', desc: 'Map the engine against the disassemblies.', color: 'var(--ogf-ink)' },
];
const cards = defs
  .map((d) => ({ ...d, doc: firstIn(d.group) }))
  .filter((d) => d.doc)
  .map((d) => ({ ...d, href: `/docs/${d.doc!.slug}` }));
---
<BaseLayout title="Docs — OpenGGF">
  <section class="hub">
    <h1>Documentation</h1>
    <div class="cards">
      {cards.map((c) => (
        <a class="card" href={c.href} style={`--c:${c.color}`}>
          <h2>{c.title}</h2><p>{c.desc}</p>
        </a>
      ))}
    </div>
  </section>
</BaseLayout>
<style>
  .hub { max-width: 1000px; margin: 0 auto; padding: 48px 20px; }
  .hub h1 { font-family: var(--font-display); font-size: 34px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 16px; }
  .card { display: block; background: var(--c); color: #fff; border: 4px solid var(--ogf-ink);
    border-radius: 10px; padding: 22px; text-decoration: none; transform: skewY(-1deg); }
  .card h2 { font-family: var(--font-display); font-size: 22px; }
  .card p { font: 600 13px/1.5 var(--font-body); margin-top: 8px; opacity: .92; }
</style>
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run test/pages/docs-hub.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/docs/index.astro test/pages/docs-hub.test.ts
git commit -m "feat: docs hub landing page with Play/Contribute/Cross-reference cards"
```

---

### Task 13: Pagefind search integration

**Files:**
- Create: `src/scripts/search.ts`
- Modify: `src/components/NavBar.astro` (load Pagefind UI on first focus)
- Test: `test/search.test.ts`

**Interfaces:**
- Consumes: the `#nav-search` button (T3). Pagefind index is produced by the `build` script (`astro build && pagefind --site dist`).

- [ ] **Step 1: Write failing test** in `test/search.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('pagefind', () => {
  it('full build produces a pagefind index in dist', () => {
    execSync('npm run build', { stdio: 'inherit' });   // astro build && pagefind --site dist
    expect(existsSync('dist/pagefind/pagefind.js')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/search.test.ts`
Expected: FAIL until the build script chains pagefind (it already does from T1) AND there is indexable content (there is, from docs). If pagefind isn't installed yet, `npm i` first.

> **Build-resolution check:** this test runs the *full* `npm run build` (i.e. `astro build` first).
> If the `/pagefind/pagefind-ui.js` dynamic import lacks `/* @vite-ignore */`, `astro build` fails
> trying to resolve a file that doesn't exist yet — so this test also guards the @vite-ignore fix.

- [ ] **Step 3: Create `src/scripts/search.ts`** (lazy-load Pagefind UI on first focus/click)

```ts
// Lazy-loads the Pagefind UI bundle (emitted to /pagefind by the build) the first
// time the user invokes search. No JS cost until then.
let loaded = false;
async function openSearch() {
  if (loaded) { document.querySelector<HTMLInputElement>('.pagefind-ui__search-input')?.focus(); return; }
  loaded = true;
  // @ts-expect-error - emitted at build time, not present during typecheck.
  // @vite-ignore prevents Astro/Vite from trying to resolve this path at build
  // time (the file only exists after `pagefind --site dist` runs post-build).
  const { PagefindUI } = await import(/* @vite-ignore */ '/pagefind/pagefind-ui.js');
  const host = document.getElementById('search-modal')!;
  host.hidden = false;
  new PagefindUI({ element: '#search-modal .inner', showSubResults: true });
  host.querySelector<HTMLInputElement>('.pagefind-ui__search-input')?.focus();
}
export function initSearch() {
  const btn = document.getElementById('nav-search');
  btn?.addEventListener('click', openSearch);
  // First keyboard focus (tabbing to the button) also loads search — matches the
  // spec's "loads on first focus". One-shot; openSearch is idempotent via `loaded`.
  btn?.addEventListener('focus', openSearch, { once: true });
  document.getElementById('search-close')?.addEventListener('click', () => {
    document.getElementById('search-modal')!.hidden = true;
  });
}
document.addEventListener('DOMContentLoaded', initSearch);
```

- [ ] **Step 4: Add the modal + script to `src/components/NavBar.astro`** — insert before `</nav>` close and add the script + stylesheet import after styles.

```astro
<div id="search-modal" hidden>
  <div class="backdrop"></div>
  <div class="box"><button id="search-close" aria-label="Close">✕</button><div class="inner"></div></div>
</div>
<link rel="stylesheet" href="/pagefind/pagefind-ui.css" />
<script>
  import { initSearch } from '../scripts/search';
  void initSearch;
</script>
<style is:global>
  #search-modal { position: fixed; inset: 0; z-index: 100; }
  #search-modal .backdrop { position: absolute; inset: 0; background: rgba(14,14,16,.6); }
  #search-modal .box { position: relative; max-width: 640px; margin: 8vh auto; background: #fff;
    border: 4px solid var(--ogf-ink); border-radius: 10px; padding: 20px; }
  #search-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer; }
</style>
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/search.test.ts`
Expected: PASS — `dist/pagefind/pagefind.js` exists after the full build.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/search.ts src/components/NavBar.astro test/search.test.ts
git commit -m "feat: Pagefind static search wired into the nav (lazy-loaded)"
```

---

### Task 14: CI/CD — cache-refresh workflow + deploy wiring docs

**Files:**
- Create: `.github/workflows/refresh-on-release.yml`
- Create: `docs/DEPLOYMENT.md` (engine-side workflow snippet + Pages/DNS steps)
- Test: `test/workflows.test.ts`

**Interfaces:**
- Consumes: `scripts/refresh-cache.mjs` (T4). Implements §2's release-triggered rebuild.

- [ ] **Step 1: Write failing test** in `test/workflows.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

describe('refresh-on-release workflow', () => {
  const wf = yaml.load(readFileSync('.github/workflows/refresh-on-release.yml', 'utf8')) as any;
  it('triggers on dispatch + schedule, never on push', () => {
    const on = wf.on || wf[true];   // js-yaml may parse `on:` as boolean key
    expect(on.repository_dispatch).toBeTruthy();
    expect(on.workflow_dispatch !== undefined).toBe(true);
    expect(on.schedule).toBeTruthy();
    expect(on.push).toBeUndefined();
  });
  it('grants contents: write', () => {
    expect(wf.permissions.contents).toBe('write');
  });
  it('commit step uses a message with no CI-skip directive', () => {
    const text = readFileSync('.github/workflows/refresh-on-release.yml', 'utf8');
    expect(text).not.toMatch(/\[skip ci\]|\[ci skip\]|\[skip pages\]/i);
    expect(text).toContain('chore: refresh releases cache');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/workflows.test.ts`
Expected: FAIL — workflow missing.

- [ ] **Step 3: Create `.github/workflows/refresh-on-release.yml`**

```yaml
name: Refresh releases cache
on:
  repository_dispatch:
    types: [engine-release]
  workflow_dispatch: {}
  schedule:
    - cron: '0 6 * * *'   # daily backstop in case a dispatch is missed
permissions:
  contents: write          # REQUIRED to push the cache commit (default token may be read-only)
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: Refresh cache from GitHub Releases
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
        run: npm run refresh-cache
      - name: Commit & push if changed
        run: |
          if ! git diff --quiet src/data/releases.cache.json; then
            git config user.name "openggf-bot"
            git config user.email "bot@openggf.com"
            git add src/data/releases.cache.json
            git commit -m "chore: refresh releases cache"
            git push
          else
            echo "No cache change."
          fi
```

- [ ] **Step 4: Create `docs/DEPLOYMENT.md`** (the cross-repo + Pages steps from the spec's open items)

````markdown
# Deployment

## Cloudflare Pages
1. Create a Pages project connected to the private `openggf-webzone` repo. Build command:
   `npm run build`. Output dir: `dist`. (Pages auto-deploys on push to `main`.)
2. Add custom domain `openggf.com` (Cloudflare DNS preferred; otherwise CNAME to `*.pages.dev`).

## Release-triggered refresh (the "latest" promise)
Add this workflow to **`jamesj999/OpenGGF`** so a published release pings the webzone repo:

```yaml
name: Notify website
on:
  release:
    types: [published]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch to webzone
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.WEBZONE_DISPATCH_PAT }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/<owner>/openggf-webzone/dispatches \
            -d '{"event_type":"engine-release"}'
```

`WEBZONE_DISPATCH_PAT` is a fine-grained PAT scoped to `openggf-webzone` with
**Contents: write** and **Metadata: read**. GitHub's "Create a repository dispatch event"
REST endpoint requires *Contents: write* for fine-grained tokens — `contents: read` is not
sufficient and the dispatch call will 403. The webzone `refresh-on-release.yml` then refreshes
the cache, commits, and pushes — which triggers the Pages build.
````

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run test/workflows.test.ts`
Expected: PASS — triggers, permission, and no-skip-directive assertions hold.

- [ ] **Step 6: Final full build + test sweep**

Run: `npm run build && npm test`
Expected: clean build (homepage, docs, news, rss, pagefind index) and all vitest specs pass.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/refresh-on-release.yml docs/DEPLOYMENT.md test/workflows.test.ts
git commit -m "ci: cache-refresh workflow + deployment runbook"
```

---

## Self-Review Notes (spec coverage)

- §2 Hosting/Pages/release-trigger → T14 (+ DEPLOYMENT.md). Pages build read-only; refresh in webzone workflow ✔
- §3 Stack (Astro/GSAP/Pagefind/fonts/build cmd) → T1, T6, T13 ✔
- §4 Repo structure + doc sync (path resolution, branch warn, validation, link rewrite, vendored) → T10 ✔ (branch-warn implemented as a soft `console.warn` in `sync-docs.mjs` Step 4; validation error is tested)
- §5 Homepage (title-card hero, bands, plate, video placeholder, sections, act-plate headers, dividers, drop animation) → T2, T5, T6, T7, T8, T9 ✔
- §6 Docs (hub, grouped sidebar, content styling, TOC, search) → T11, T12, T13 ✔
- §7 Data sources + degradation contract (downloads/releases/hero version, cache, literal URLs) → T4, T5, T7, T9 ✔
- §8 Components isolation → one component per file across T2–T12 ✔
- §9 A11y/perf (reduced-motion, semantic headings, keyboard nav, woff2/swap) → T1 tokens, T6 motion gate, T3/T8 semantics ✔
- §10 Open items (video placeholder T5; DNS + webzone repo + webhook wiring → DEPLOYMENT.md T14) ✔

### Review-round fixes (post-plan)

- **Pagefind dynamic import** (T13): `await import(/* @vite-ignore */ '/pagefind/pagefind-ui.js')` so `astro build` doesn't try to resolve a post-build file; the full-build test guards it.
- **Stale doc pruning** (T10): `sync-docs.mjs` wipes `src/content/docs` before each run; a test seeds a stale file and asserts it's pruned.
- **Dispatch PAT** (T14 DEPLOYMENT.md): fine-grained PAT needs **Contents: write** (GitHub requirement for repository_dispatch), not `contents: read`.
- **Reduced-motion video** (T5/T6): markup omits `autoplay` (poster shows by default); the motion-gated `initAnimations` opts the video into playback only when motion is allowed. Test asserts no `autoplay` in markup.
- **Docs hub links** (T12): card hrefs derived from the docs collection (first doc per group), empty groups dropped; the build test still asserts the three group titles render after a real sync.

### Review-round 2 fixes

- **sync-docs test isolation** (T10): added `--out-dir`; all three sync tests run against a per-test temp dir (never the tracked `src/content/docs`), so the full-suite sweep can't race fixture docs against the homepage/docs/Pagefind build tests.
- **SectionReleases adjacent siblings** (T7): wrapped the truthy ternary branch (`<ul>` + `<a>`) in a `<>…</>` fragment — would otherwise be a build/parse failure.
- **SITE_FALLBACK_VERSION** (T9): now `import.meta.env.SITE_FALLBACK_VERSION ?? 'v0.5'` (build-time injected per spec; literal is the documented dev default).
- **Pagefind first-focus** (T13): `#nav-search` gets a one-shot `focus` listener in addition to `click`, matching the spec's "loads on first focus"; `openSearch` is idempotent via the `loaded` flag.
