# 🏴‍☠️ LOS POLOS KALÓZOK (PIRATES) — 3D Browser Pirate Game

> **Category:** 3D Pirate, Sailing & Naval Combat  
> **Repository:** [lospolosadwords-dev/kalozok](https://github.com/lospolosadwords-dev/kalozok)  
> **Developer / Account:** Los Polos Amigos Kft. (Hungarian Indie Shop)  
> **License:** MIT (Code) / CC0 (Art & Audio)  
> **Stars:** Small account (< 10 stars)  
> **Live Playable Link:** [skynet.lospolo.hu/kalozok/?lang=en](https://skynet.lospolo.hu/kalozok/?lang=en)  

---

## 📸 In-Game Screenshots

| High Seas Sailing & Wind Trim | FTL-Style 3-Deck Cutaway View |
| :---: | :---: |
| ![High Seas Sailing](../screenshots/kalozok/sailing.jpg) | ![Ship Cutaway Deck View](../screenshots/kalozok/deck.jpg) |

| Night Storm & Heavy Ocean Swell |
| :---: |
| ![Night Storm](../screenshots/kalozok/storm.jpg) |

---

## 🌟 Project Overview
**LOS POLOS KALÓZOK** is a full-featured 3D pirate game that runs entirely inside a standard browser tab. You navigate open oceans with real wind aerodynamics, trade between islands, fire broadside cannons, board enemy vessels, and hunt mythical sea beasts like the Kraken at the edge of the world map.

Uniquely, the entire game engine, AI, rendering, economy, and multiplayer client are contained in a **single 4,300-line `index.html` file with NO build step and NO framework**, powered directly by **Three.js r128**.

---

## 🎮 Key Features & Mechanics
- **Ocean & Environment:**
  - Deterministic seeded ocean world with organic island chains, photogrammetric rock cliffs, whirlpools, and waterfalls at the edge of a flat earth.
  - Complete day/night cycle (~7 minutes), realistic moon phases, 1,100 twinkling stars, dynamic fog, and thunderstorms with lightning and heavy swell.
  - Underwater camera view when plunging beneath waves.
- **Realistic Sailing Physics:**
  - Real wind vectors and sail trim dynamics: ships heel realistically into turns, generate wake trails and bow spray, and can run aground on sandbars.
- **Naval Combat & Boarding:**
  - Independent left and right broadside cannons with 3 ammunition types: *round shot* (hull damage), *chain shot* (shreds enemy sails), and *grapeshot* (clears enemy crew).
  - Boarding mechanics for close-quarters ship capture.
  - Telegraphed enemy salvos and captain cooldown abilities.
- **FTL-Style 3-Deck Ship Cutaway:**
  - Right-click your ship at any time to zoom into an interior cross-section view.
  - Station crew members at the cannons, sails, or bilge pumps to gain live combat and mobility buffs.
  - Real-time fire and flood simulation: watch water and blaze spread room-by-room across all 3 decks.
- **Port Trading & Campaign:**
  - Dynamic commodity prices that fluctuate with player supply and demand.
  - Progressive ship upgrades: start from a humble *Raft* and build up to a *Brig*, *Galley*, and massive *Ship of the Line*.
  - Boss battles including sea serpents, ghost ships, and the mythical Kraken.
- **Multiplayer (2–8 Players):**
  - Lightweight file-backed PHP polling relay: lobby system, chat, shared map seed, and co-op Kraken hunts.

---

## 🛠️ Tech Stack & Architecture
- **Engine:** Three.js r128 loaded via CDN.
- **Structure:** Single self-contained `index.html` file.
- **Assets:** CC0 3D models and textures.
- **Multiplayer:** Plain PHP relay (`mp.php`) requiring no complex database.
- **Mobile Support:** Built-in virtual joystick, responsive touch controls, and local save storage.

---

## 🚀 How to Clone & Run Locally
Requires **no npm install, no node, no build tools**:

```bash
# 1. Clone repository
git clone https://github.com/lospolosadwords-dev/kalozok.git
cd kalozok

# 2. Run local static HTTP server
python -m http.server 8188

# 3. Open in your browser
# English: http://localhost:8188/?lang=en
# Hungarian: http://localhost:8188/
```

---

## 💡 Why This Project is Great to Copy & Learn From
1. **Ultimate Single-File Three.js Showcase:** Proves you can build a complete 3D game with sailing physics, combat, sound, shaders, and UI in one clean, readable file.
2. **FTL Deck Management in 3D:** The dual exterior sailing camera and interior cutaway deck management is an exceptional architectural pattern to study.
3. **Instant Portability:** Zero dependencies means you can drop it into any web folder, WordPress site, or Electron wrapper and it works immediately.
