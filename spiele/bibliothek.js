'use strict';

const featured = document.querySelector('#featured');
const games = document.querySelector('#games');
const filters = document.querySelector('#filters');
const search = document.querySelector('#search');
const status = document.querySelector('#status');
let catalog = [];
let activeTag = '';

function makeCard(game, spotlight) {
  const link = document.createElement('a');
  link.className = 'game-card';
  link.href = game.url;
  const cover = document.createElement('div');
  cover.className = 'cover';
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.loading = spotlight ? 'eager' : 'lazy';
  img.addEventListener('error', () => img.remove());
  img.src = new URL(game.image || `bilder/${game.id}.jpg`, new URL('../', location.href));
  cover.append(img);

  const copy = document.createElement('div');
  copy.className = 'copy';
  const title = document.createElement(spotlight ? 'h2' : 'h3');
  title.textContent = game.title;
  const tags = document.createElement('p');
  tags.className = 'tags';
  tags.textContent = game.tags.join(' · ');
  const description = document.createElement('p');
  description.className = 'description';
  description.textContent = game.blurb || '';
  const arrow = document.createElement('span');
  arrow.className = 'play';
  arrow.textContent = game.play === 'external' ? '↗' : '→';
  arrow.setAttribute('aria-hidden', 'true');
  copy.append(tags, title, description, arrow);
  link.append(cover, copy);
  return link;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('de');
  const matches = catalog.filter(game =>
    (!activeTag || game.tags.includes(activeTag)) &&
    [game.title, game.blurb, ...game.tags].join(' ').toLocaleLowerCase('de').includes(query)
  );
  games.replaceChildren(...matches.map(game => makeCard(game, false)));
  status.textContent = matches.length === 1 ? '1 Spiel' :
    matches.length ? `${matches.length} Spiele` : 'Keine Spiele gefunden.';
}

function buildFilters() {
  const counts = new Map();
  for (const game of catalog) {
    for (const tag of game.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const tags = [...counts].filter(([, count]) => count > 1)
    .sort(([tagA, a], [tagB, b]) => b - a || tagA.localeCompare(tagB, 'de'))
    .slice(0, 6).map(([tag]) => tag);
  if (!tags.length) return;
  for (const tag of ['', ...tags]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = tag || 'Alle';
    button.setAttribute('aria-pressed', String(!tag));
    button.onclick = () => {
      activeTag = tag;
      for (const chip of filters.children) chip.setAttribute('aria-pressed', String(chip === button));
      render();
    };
    filters.append(button);
  }
  filters.hidden = false;
}

async function load() {
  try {
    const source = new URL('../projects.json', location.href);
    const response = await fetch(source, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    catalog = data.projects.filter(game => game.kind === 'Spiel' && game.href).flatMap(game => {
      const url = new URL(game.href, source);
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      return [{ ...game, url: url.href, tags: game.tags || [] }];
    });
    const spotlight = catalog.filter(game => game.spotlight);
    featured.replaceChildren(...spotlight.map(game => makeCard(game, true)));
    featured.hidden = !spotlight.length;
    search.addEventListener('input', render);
    buildFilters();
    render();
  } catch {
    status.textContent = 'Die Spielebibliothek konnte nicht geladen werden.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Erneut laden';
    retry.onclick = () => location.reload();
    games.replaceChildren(retry);
  }
}

load();
