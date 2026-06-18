import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve, posix } from 'node:path';

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

// Denylist: skip any markdown file whose basename (uppercased, no .md) matches one of these.
const DENY_BASENAMES = new Set(['PLAN', 'TODO', 'DRAFT', 'WIP', 'INTERNAL', 'SCRATCH', 'NOTES']);

const isDenied = (name) => DENY_BASENAMES.has(name.replace(/\.md$/i, '').toUpperCase());

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

// ─── Pass A: collect all synced files into a repoPath→slug map ─────────────
// repoPath: POSIX path relative to engine root, e.g. "docs/guide/playing/controls.md"
// slug:     output route WITHOUT .md, e.g. "guide/playing/controls"
//           guide files: strip leading "docs/"; root files: "reference/<lowercased-basename>"

/** @type {Array<{absSrc: string, repoPath: string, slug: string}>} */
const records = [];
/** @type {Map<string, string>} repoPath (with .md) → slug (no .md) */
const repoPathToSlug = new Map();

function collectDir(absDir, relDir) {
  for (const name of readdirSync(absDir)) {
    if (isDenied(name)) continue;
    const abs = join(absDir, name);
    const rel = join(relDir, name).replace(/\\/g, '/');  // keep POSIX
    if (statSync(abs).isDirectory()) collectDir(abs, rel);
    else if (name.endsWith('.md')) {
      // repoPath = rel (e.g. "docs/guide/playing/controls.md")
      // slug = strip leading "docs/" then strip ".md"
      const slug = rel.replace(/^docs\//, '').replace(/\.md$/, '');
      records.push({ absSrc: abs, repoPath: rel, slug });
      repoPathToSlug.set(rel, slug);
    }
  }
}

for (const d of ALLOW_DIRS) {
  const abs = join(enginePath, d);
  if (existsSync(abs)) collectDir(abs, d);
}
for (const f of ALLOW_FILES) {
  if (isDenied(f)) continue;
  const abs = join(enginePath, f);
  if (existsSync(abs)) {
    // root files: slug = "reference/<lowercased-basename-no-md>"
    const slug = 'reference/' + f.toLowerCase().replace(/\.md$/, '');
    const repoPath = f;  // e.g. "CONTRIBUTING.md"
    records.push({ absSrc: abs, repoPath, slug });
    repoPathToSlug.set(repoPath, slug);
  }
}

// ─── Pass B: rewrite links, inject frontmatter, write output ───────────────

/**
 * Rewrite every relative .md link in `txt`.
 * - Matches links that are NOT protocol (http:/https:/mailto:), NOT site-absolute (/),
 *   NOT anchor-only (#).
 * - Resolved against the SOURCE file's repoPath directory (POSIX).
 * - Synced target → /docs/<slug>[hash]
 * - Non-synced target → GitHub blob URL[hash]
 */
const GITHUB_BASE = 'https://github.com/jamesj999/OpenGGF/blob/develop/';
const LINK_RE = /\]\(((?!https?:|mailto:|\/|#)[^)\s]+?)\.md(#[^)]*)?\)/g;

function rewriteLinks(txt, repoPath) {
  const srcDir = posix.dirname(repoPath);
  return txt.replace(LINK_RE, (_, p, hash) => {
    // Resolve relative to source file's repo directory
    const targetRepo = posix.normalize(posix.join(srcDir, p + '.md'));
    if (repoPathToSlug.has(targetRepo)) {
      const slug = repoPathToSlug.get(targetRepo);
      return `](/docs/${slug}${hash || ''})`;
    }
    // Non-synced: GitHub blob fallback (strip .md so the URL stays clean)
    return `](${GITHUB_BASE}${targetRepo.replace(/\.md$/, '')}${hash || ''})`;
  });
}

// Prune stale output: regenerate the vendored docs from scratch each run so deleted,
// renamed, or newly-excluded files never linger in the published site.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let count = 0;
for (const { absSrc, repoPath, slug } of records) {
  const dest = join(OUT, slug + '.md');
  const raw = readFileSync(absSrc, 'utf8');
  const title = titleFor(raw, slug);
  const group = groupFor('/' + slug);
  const body = rewriteLinks(raw, repoPath);
  const fm = `---\ntitle: ${JSON.stringify(title)}\ngroup: ${JSON.stringify(group)}\norder: 99\n---\n\n`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, fm + body);
  count++;
}
console.log(`sync-docs: synced ${count} docs from ${enginePath}`);
