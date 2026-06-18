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
