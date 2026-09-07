import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import DiscoveryContent from '../app/discovery-content';
import {
  faqs,
  structuredData,
  robotsText,
  sitemapXml,
  llmsText,
  guideMarkdown,
} from '../lib/discovery';
import { CANONICAL_URL, appPath } from '../lib/site';
import { GET as manifest } from '../app/manifest.webmanifest/route';

void test('FAQ structured data matches the crawlable answers and retains both creator links', () => {
  const html = renderToStaticMarkup(createElement(DiscoveryContent));
  const faqNode = structuredData['@graph'].find(
    (node) => node['@type'] === 'FAQPage',
  )!;
  const answers = faqNode.mainEntity as {
    name: string;
    acceptedAnswer: { text: string };
  }[];
  assert.equal(answers.length, faqs.length);
  for (const [index, faq] of faqs.entries()) {
    assert.equal(answers[index].name, faq.question);
    assert.equal(answers[index].acceptedAnswer.text, faq.answer);
    assert.ok(html.includes(`id="${faq.id}"`));
    assert.ok(guideMarkdown.includes(faq.answer));
  }
  assert.match(html, /href="https:\/\/shrinath\.me"/);
  assert.match(html, /href="https:\/\/owleye\.dev"/);
  const encoded = JSON.stringify(structuredData);
  assert.ok(!encoded.includes('aggregateRating'));
  assert.ok(!encoded.includes('reviewCount'));
});
void test('discovery URLs consolidate on the requested canonical and crawler rules allow rendering assets', () => {
  assert.equal(CANONICAL_URL, 'https://lowkey.tools/chesscape');
  assert.equal((sitemapXml.match(/<loc>/g) ?? []).length, 1);
  assert.ok(sitemapXml.includes(`<loc>${CANONICAL_URL}</loc>`));
  assert.ok(robotsText.includes(`Sitemap: ${CANONICAL_URL}/sitemap.xml`));
  assert.ok(robotsText.includes(`Disallow: ${appPath('/api/')}`));
  assert.ok(!robotsText.includes('Disallow: /_next'));
  assert.ok(llmsText.includes(`${CANONICAL_URL}/index.md`));
  assert.ok(llmsText.includes('https://owleye.dev'));
  assert.ok(llmsText.includes('https://shrinath.me'));
});
void test('install manifest is scoped to the app and every declared PNG exists at its advertised size', async () => {
  const response = manifest();
  assert.equal(
    response.headers.get('content-type'),
    'application/manifest+json',
  );
  const data = (await response.json()) as {
    start_url: string;
    scope: string;
    orientation: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  assert.equal(data.start_url, appPath('/'));
  assert.equal(data.scope, appPath('/'));
  assert.equal(data.orientation, 'any');
  for (const icon of data.icons) {
    const path = icon.src.slice(appPath('/').length);
    const bytes = readFileSync(`public/${path}`);
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  assert.equal(
    data.icons.filter(
      (icon: { purpose: string }) => icon.purpose === 'maskable',
    ).length,
    1,
  );
  const apple = readFileSync('public/apple-touch-icon.png');
  assert.equal(apple.readUInt32BE(16), 180);
});
