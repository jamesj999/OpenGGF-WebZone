import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ZigzagBand from '../../src/components/ZigzagBand.astro';
import ZigzagDivider from '../../src/components/ZigzagDivider.astro';
import ActPlateHeader from '../../src/components/ActPlateHeader.astro';

describe('primitives', () => {
  it('ZigzagBand left emits a clip-path polygon and the given color', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ZigzagBand, { props: { side: 'left', color: '#E62B33' } });
    expect(html).toContain('clip-path');
    expect(html).toContain('polygon');
    expect(html).toContain('#E62B33');
  });
  it('ZigzagDivider emits a clip-path polygon, uses default color, and accepts a custom color', async () => {
    const c = await AstroContainer.create();
    const defaultHtml = await c.renderToString(ZigzagDivider, { props: {} });
    expect(defaultHtml).toContain('clip-path');
    expect(defaultHtml).toContain('polygon');
    expect(defaultHtml).toContain('var(--ogf-blue)');
    const customHtml = await c.renderToString(ZigzagDivider, { props: { color: '#E62B33' } });
    expect(customHtml).toContain('#E62B33');
  });
  it('ActPlateHeader renders label text', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ActPlateHeader, { props: { label: 'Download' } });
    expect(html).toContain('Download');
  });
  it('ActPlateHeader renders accent in a <b> tag', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ActPlateHeader, { props: { label: 'Download', accent: 'Now' } });
    expect(html).toMatch(/<b[\s>]/);
    expect(html).toContain('Now');
  });
});
