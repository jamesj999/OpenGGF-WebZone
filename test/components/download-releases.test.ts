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
    expect(html).not.toContain('/releases/latest');
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
  it('prerelease release shows (pre) label', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Releases, { props: { releases: [
      { tag: 'v0.6-rc1', name: 'v0.6-rc1', url: 'u', prerelease: true, publishedAt: '2026-06-01T00:00:00Z', body: '', assets: [] }] } });
    expect(html).toContain('(pre)');
  });
});
