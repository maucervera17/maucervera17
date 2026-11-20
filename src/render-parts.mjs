// Renders the profile's pills, section titles and project cards to PNG (light + dark).
// Usage: node src/render-parts.mjs  (expects `python3 -m http.server 3071` serving src/)
import puppeteer from 'puppeteer-core';

const BASE = 'http://127.0.0.1:3071/parts.html';
const OUT = new URL('../assets/', import.meta.url).pathname;

const pills = [
  ['portfolio', 'maucervera.com', true],
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['email', 'Email'],
  ['call', 'Book a call'],
];
const titles = [
  ['about', '01', 'About'],
  ['work', '02', 'Selected work'],
  ['open-source', '03', 'Open source'],
  ['activity', '04', 'Activity'],
];
const cards = [
  ['ulika', 'Ulika', 'AI SaaS'],
  ['leadgentic-studio', 'Leadgentic Studio', 'Agentic site generator'],
  ['barasu', 'Barasu', 'Firecrawl prize'],
  ['wp-jarvis', 'WP Jarvis', 'Agentic page builder'],
  ['matching-unicorns', 'Matching Unicorns', 'Hiring platform'],
  ['enerdrais', 'Enerdrais', 'Cleantech branding'],
];

const jobs = [
  ...pills.map(([f, label, primary]) => [`pill-${f}`, { part: 'pill', label, ...(primary ? { primary: 1 } : {}) }]),
  ...titles.map(([f, n, label]) => [`title-${f}`, { part: 'title', n, label }]),
  ...cards.map(([id, name, cat]) => [`card-${id}`, { part: 'card', id, name, cat }]),
];

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 400, deviceScaleFactor: 2 });
for (const [file, params] of jobs) {
  for (const theme of ['light', 'dark']) {
    await page.goto(`${BASE}?${new URLSearchParams(params)}#${theme}`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' }); // hash-only changes don't rerun the script
    await page.waitForFunction(() => document.title === 'ready');
    const el = await page.$('#out');
    await el.screenshot({ path: `${OUT}${file}-${theme}.png`, omitBackground: true });
  }
}
await browser.close();
console.log(`rendered ${jobs.length * 2} images`);
