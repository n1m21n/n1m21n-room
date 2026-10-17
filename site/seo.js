// SEO + AI agents: the room is a canvas, so crawlers and agents get the same content as plain text.
// Built from public/data so it never drifts: JSON-LD + a screen-reader "about" block in index.html,
// and robots.txt, sitemap.xml, llms.txt in dist.
import fs from 'node:fs';
import path from 'node:path';

export const SITE = 'https://naman.infinitedevices.org';
const BIO = 'naman is a visual artist, electronic musician, creative technologist, and dancer based in delhi ncr.';
const read = f => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'public/data', f), 'utf8'));
const tracks = a => `${a.tracks.length} track${a.tracks.length > 1 ? 's' : ''}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function data() {
  const music = read('music.json'), links = read('links.json'), films = read('films.json').films, art = read('art.json');
  const albums = music.albums.filter(a => a.kind === 'album');
  const artworks = art.halls.reduce((n, h) => n + h.works.length, 0);
  return { music, links, films, albums, artworks };
}

function jsonld({ links, albums }) {
  const sameAs = links.socials.map(s => s.url);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'n1m21n', inLanguage: 'en', author: { '@id': `${SITE}/#naman` } },
      { '@type': 'Person', '@id': `${SITE}/#naman`, name: 'Naman', alternateName: 'n1m21n', url: `${SITE}/`, description: BIO,
        jobTitle: ['Visual artist', 'Electronic musician', 'Creative technologist', 'Dancer'],
        homeLocation: { '@type': 'Place', name: 'Delhi NCR, India' },
        alumniOf: [{ '@type': 'CollegeOrUniversity', name: 'Hansraj College, University of Delhi' }, { '@type': 'CollegeOrUniversity', name: 'IIM Ranchi' }],
        founder: { '@type': 'Organization', name: 'Infinite Devices', url: 'https://infinitedevices.org' }, sameAs },
      { '@type': 'MusicGroup', '@id': `${SITE}/#music`, name: 'Naman', alternateName: 'n1m21n', genre: 'Electronic', member: { '@id': `${SITE}/#naman` },
        sameAs: links.socials.filter(s => ['spotify', 'apple_music', 'youtube_music', 'bandcamp'].includes(s.id)).map(s => s.url),
        album: albums.map(a => ({ '@type': 'MusicAlbum', name: a.title, datePublished: a.released, numTracks: a.tracks.length, image: `${SITE}/${a.cover['1000']}`, sameAs: Object.values(a.links) })) },
    ],
  };
}

function about({ links, albums, films, artworks }) {
  const li = (href, text) => `<li><a href="${esc(href)}">${esc(text)}</a></li>`;
  return `<main class="sr" id="about">
<h2>Naman (n1m21n): visual artist and electronic musician</h2>
<p>${esc(BIO)} This site is an interactive 3D room: walk around, play his records, read his books, watch films on the tv and visit a gallery of ${artworks} artworks.</p>
<h3>Discography</h3>
<ul>${albums.map(a => li(a.links.spotify || a.links.bandcamp || Object.values(a.links)[0], `${a.title} (${a.released.slice(0, 4)}, ${tracks(a)})`)).join('')}</ul>
<h3>Software</h3>
<ul>${links.software.map(s => li(s.url, `${s.label}: ${s.tagline}`)).join('')}</ul>
<h3>Elsewhere</h3>
<ul>${links.socials.map(s => li(s.url, s.label)).join('')}</ul>
<p>${films.length} favourite films play on the tv in the room. A plain-text summary for AI agents is at <a href="/llms.txt">/llms.txt</a>.</p>
</main>`;
}

function llms({ links, albums, films, artworks, music }) {
  const line = (t, u, d) => `- [${t}](${u})${d ? `: ${d}` : ''}`;
  const singles = music.albums.filter(a => a.kind !== 'album');
  return `# Naman (n1m21n)

> ${BIO} Portfolio site: an interactive 3D room (three.js) where a toon version of Naman goes through his day on India time. Visitors walk around, play his records, open a gallery of ${artworks} artworks and watch films on the tv.

The site is a WebGL canvas; everything it shows is listed here and in the JSON files below.

## Discography (albums)
${albums.map(a => line(`${a.title} (${a.released})`, a.links.spotify || a.links.bandcamp || Object.values(a.links)[0], `${tracks(a)}: ${a.tracks.map(t => t.title).join(', ')}`)).join('\n')}

## Bandcamp releases
${singles.map(a => line(`${a.title} (${a.released})`, Object.values(a.links)[0], tracks(a))).join('\n')}

## Software
${links.software.map(s => line(s.label, s.url, `${s.tagline}; source ${s.source}`)).join('\n')}

## Timeline
${links.timeline.map(t => `- ${t.from}${t.to ? `–${t.to}` : ''}: ${t.label}`).join('\n')}

## Links
${links.socials.map(s => line(s.label, s.url)).join('\n')}

## Data
${line('music.json', `${SITE}/data/music.json`, 'albums, tracks, release dates, streaming links')}
${line('art.json', `${SITE}/data/art.json`, 'the gallery, hall by hall')}
${line('films.json', `${SITE}/data/films.json`, `${films.length} films on the tv`)}
${line('books.json', `${SITE}/data/books.json`, 'the bookshelf')}
${line('links.json', `${SITE}/data/links.json`, 'socials, software, timeline')}
`;
}

const robots = `# everyone welcome, search engines and AI agents alike
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`;

export function seo() {
  return {
    name: 'seo',
    transformIndexHtml(html) {
      const d = data();
      return html
        .replace('<!--seo:jsonld-->', `<script type="application/ld+json">${JSON.stringify(jsonld(d)).replace(/</g, '\\u003c')}</script>`)
        .replace('<!--seo:about-->', about(d));
    },
    generateBundle() {
      const d = data();
      for (const [fileName, source] of [['robots.txt', robots], ['sitemap.xml', sitemap()], ['llms.txt', llms(d)]])
        this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
