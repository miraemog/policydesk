// Builds search-engine-friendly files for PolicyDesk from the article data in index.html.
// Run after adding or editing an article:   node tools/build-seo.mjs
// Outputs: articles/<slug>.html, sitemap.xml, robots.txt, and refreshes the
// article link list in index.html (between the SEO-ARTICLE-LIST markers).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://miraemog.github.io/policydesk/';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const indexPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

// ── Pull the `journals` and `publishers` arrays out of the page script ──
function extractLiteral(src, startToken) {
  const start = src.indexOf(startToken);
  if (start < 0) throw new Error(`Not found: ${startToken}`);
  let i = src.indexOf(startToken.endsWith('[') ? '[' : '{', start);
  const open = src[i], close = open === '[' ? ']' : '}';
  let depth = 0, inStr = null, esc = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error('Unbalanced literal');
}
const OWNER_KEY = (html.match(/const OWNER_KEY\s*=\s*'([^']+)'/) || [])[1] || 'owner';
const ctx = { OWNER_KEY };
const journals = vm.runInNewContext('(' + extractLiteral(html, 'let journals = [') + ')', ctx);
const publishers = vm.runInNewContext('(' + extractLiteral(html, 'const publishers = {') + ')', ctx);

// ── Helpers ──
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = t => t.toLowerCase().split(':')[1]?.trim()
  ? t.toLowerCase().replace(/^[^:]*:\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  : t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…';
const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const items = journals.map(j => ({ ...j, slug: slugify(j.title), author: publishers[j.authorKey]?.name || 'PolicyDesk' }));

// ── Article pages ──
fs.mkdirSync(path.join(ROOT, 'articles'), { recursive: true });
for (const j of items) {
  const url = `${SITE}articles/${j.slug}.html`;
  const desc = clip(j.abstract, 155);
  const ld = {
    '@context': 'https://schema.org', '@type': 'ScholarlyArticle',
    headline: clip(j.title, 110), name: j.title, abstract: j.abstract,
    datePublished: j.date, inLanguage: 'en', articleSection: j.category,
    keywords: [j.category, ...j.countries, 'comparative policy'].join(', '),
    author: { '@type': 'Person', name: j.author },
    isPartOf: { '@type': 'Periodical', name: 'PolicyDesk', url: SITE },
    mainEntityOfPage: url,
  };
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(j.title)} | PolicyDesk</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(j.author)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="PolicyDesk">
<meta property="og:title" content="${esc(j.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="article:published_time" content="${j.date}">
<meta name="twitter:card" content="summary">
<meta name="citation_title" content="${esc(j.title)}">
<meta name="citation_author" content="${esc(j.author)}">
<meta name="citation_publication_date" content="${j.date.replace(/-/g, '/')}">
<meta name="citation_journal_title" content="PolicyDesk">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
:root{--primary:#1a3a5c;--accent:#2d7dd2;--text:#1a1a2e;--muted:#6b7280;--bg:#f4f6f9;--border:#e5e7eb}
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;font-size:16px}
header{background:var(--primary);padding:18px 16px}header a{color:#fff;text-decoration:none;font-weight:700;font-size:22px}
header span{display:block;color:rgba(255,255,255,.6);font-size:12px}
main{max-width:780px;margin:0 auto;padding:32px 16px 64px;background:#fff;border-left:1px solid var(--border);border-right:1px solid var(--border)}
.cat{display:inline-block;background:#e8f2fd;color:var(--accent);font-size:12px;font-weight:700;padding:3px 10px;text-transform:uppercase;letter-spacing:.5px}
h1{font-size:28px;line-height:1.3;margin:12px 0}.meta{color:var(--muted);font-size:14px;margin-bottom:24px}
.tags span{display:inline-block;border:1px solid var(--border);font-size:12px;padding:2px 8px;margin:0 6px 6px 0}
h2,h3{color:var(--primary);margin-top:1.6em}blockquote{border-left:3px solid var(--accent);margin:1em 0;padding:.2em 1em;color:#374151}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid var(--border);padding:6px 10px}
a.back{color:var(--accent)}
</style>
</head>
<body>
<header><a href="../">PolicyDesk</a><span>Comparative Policy Research Journal</span></header>
<main>
<p><a class="back" href="../">← All articles</a></p>
<span class="cat">${esc(j.category)}</span>
<h1>${esc(j.title)}</h1>
<div class="tags">${j.countries.map(c => `<span>${esc(c)}</span>`).join('')}</div>
<p class="meta">By ${esc(j.author)} · Published <time datetime="${j.date}">${fmtDate(j.date)}</time></p>
<article>
<h2>Abstract</h2>
<p>${esc(j.abstract)}</p>
${j.content}
</article>
<p><a class="back" href="../">← All articles</a></p>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'articles', `${j.slug}.html`), page);
}

// ── sitemap.xml & robots.txt ──
const latest = items.map(j => j.date).sort().at(-1);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${latest}</lastmod></url>
${items.map(j => `  <url><loc>${SITE}articles/${j.slug}.html</loc><lastmod>${j.date}</lastmod></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

// ── Crawlable article list in index.html ──
const START = '<!-- SEO-ARTICLE-LIST:START -->', END = '<!-- SEO-ARTICLE-LIST:END -->';
const list = `${START}
<section class="seo-article-list" aria-label="All articles">
    <h2>All Articles</h2>
    <ul>
${[...items].sort((a, b) => b.date.localeCompare(a.date)).map(j => `        <li><a href="articles/${j.slug}.html">${esc(j.title)}</a> <span>(${fmtDate(j.date)})</span></li>`).join('\n')}
    </ul>
</section>
${END}`;
let out = fs.readFileSync(indexPath, 'utf8');
out = out.includes(START)
  ? out.replace(new RegExp(`${START}[\\s\\S]*?${END}`), list)
  : out.replace('</body>', `${list}\n</body>`);
fs.writeFileSync(indexPath, out);

console.log(`Built ${items.length} article pages, sitemap.xml, robots.txt`);
items.forEach(j => console.log('  articles/' + j.slug + '.html'));
