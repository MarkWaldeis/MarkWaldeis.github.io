'use strict';

const Save = (() => {
  const KEY = 'jumpHeroesSaveV1';
  const def = () => ({
    wallet: 0,
    ownedChars: ['blitz'],
    selChar: 'blitz',
    ownedTrails: ['none'],
    trail: 'none',
    upgrades: {},
    progress: {},
    settings: { master: 0.8, music: 0.55, sfx: 0.8 }
  });

  let data = def();
  let memOnly = false;
  let dirty = false;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        data = Object.assign(def(), o);
        data.settings = Object.assign(def().settings, o.settings || {});
        data.progress = o.progress || {};
        data.upgrades = o.upgrades || {};
        if (!Array.isArray(data.ownedChars) || !data.ownedChars.length) data.ownedChars = ['blitz'];
        if (!Array.isArray(data.ownedTrails) || !data.ownedTrails.length) data.ownedTrails = ['none'];
        if (!data.ownedChars.includes(data.selChar)) data.selChar = 'blitz';
        if (!data.ownedTrails.includes(data.trail)) data.trail = 'none';
      }
    } catch (e) { memOnly = true; }
  }

  function flush() {
    dirty = false;
    if (memOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { memOnly = true; }
  }

  function mark() { dirty = true; }

  setInterval(() => { if (dirty) flush(); }, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) flush(); });
  window.addEventListener('beforeunload', () => { if (dirty) flush(); });

  function addCoins(n) { data.wallet += n; mark(); }

  function spend(n) {
    if (data.wallet >= n) { data.wallet -= n; mark(); return true; }
    return false;
  }

  function buyChar(id) {
    const c = getChar(id);
    if (data.ownedChars.includes(id)) return true;
    if (spend(c.price)) { data.ownedChars.push(id); mark(); return true; }
    return false;
  }

  function equipChar(id) {
    if (data.ownedChars.includes(id)) { data.selChar = id; mark(); return true; }
    return false;
  }

  function hasUpgrade(id) { return !!data.upgrades[id]; }

  function buyUpgrade(id) {
    const u = getUpgrade(id);
    if (!u || data.upgrades[id]) return false;
    if (u.requires && !data.upgrades[u.requires]) return false;
    if (spend(u.price)) { data.upgrades[id] = 1; mark(); return true; }
    return false;
  }

  function heartsBonus() {
    return (data.upgrades.heart1 ? 1 : 0) + (data.upgrades.heart2 ? 1 : 0);
  }

  function ownTrail(id) { return data.ownedTrails.includes(id); }

  function buyTrail(id) {
    const t = getTrail(id);
    if (ownTrail(id)) return true;
    if (spend(t.price)) { data.ownedTrails.push(id); mark(); return true; }
    return false;
  }

  function equipTrail(id) {
    if (ownTrail(id)) { data.trail = id; mark(); return true; }
    return false;
  }

  function getStars(i) { const p = data.progress[i]; return p ? p.stars : 0; }

  function setStars(i, s) {
    if (s > getStars(i)) { data.progress[i] = { stars: s }; mark(); }
  }

  function unlocked(i) { return i === 0 || getStars(i - 1) > 0; }

  function setSetting(k, v) { data.settings[k] = v; mark(); flush(); }

  function resetAll() { data = def(); mark(); flush(); }

  load();

  return {
    get data() { return data; },
    load, flush, addCoins, spend,
    buyChar, equipChar,
    hasUpgrade, buyUpgrade, heartsBonus,
    ownTrail, buyTrail, equipTrail,
    getStars, setStars, unlocked,
    setSetting, resetAll
  };
})();
