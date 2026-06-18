// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
export async function GET(context: APIContext) {
  const posts = await getCollection('news');
  return rss({
    title: 'OpenGGF News', description: 'Updates from the OpenGGF project',
    site: context.site,
    items: posts.map((p) => ({ title: p.data.title, pubDate: p.data.date,
      description: p.data.summary, link: `/news/${p.slug}/` })),
  });
}
