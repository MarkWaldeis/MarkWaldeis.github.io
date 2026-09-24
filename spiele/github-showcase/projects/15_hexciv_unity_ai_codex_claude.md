# 🏛️ HexCiv (Unity 6.3) — 80-Civ 4X Game Co-Developed by Claude Code & Codex

> **Category:** 3D Civilization / Multi-Agent AI Co-Development  
> **Repository:** [kanta13jp1/HexCiv](https://github.com/kanta13jp1/HexCiv)  
> **Developer / Author:** `kanta13jp1`  
> **License:** Custom Open Source  
> **Stars:** Small account (0 stars)  
> **AI Architecture:** **Co-developed by Claude Code and OpenAI Codex**  
> **Engine:** Unity 6.3 LTS (`6000.3.20f1`) + C#  

---

## 📸 In-Game Screenshots

| World History Encyclopedia Banner | HexCiv Application Icon |
| :---: | :---: |
| ![World History](../screenshots/hexciv-unity-ai/world_history_banner.png) | ![App Icon](../screenshots/hexciv-unity-ai/app_icon.png) |

---

## 🌟 Project Overview
**HexCiv** is an expansive Civilization-like 4X strategy game built in Unity 6.3 LTS that features **80 playable historical civilizations**, culture victories, a world history encyclopedia, spectator mode up to 256x speed, and hexagonal supply lines.

The repository includes `COLLABORATION.md`, `CLAUDE.md`, and `AGENTS.md` which document the precise multi-agent protocols used by **Claude Code** and **OpenAI Codex** to write, test, and refactor the codebase without breaking deterministic simulation tests.

---

## 🎮 Key Features & Mechanics
- **80 Playable Civilizations:**
  - Covers 6 regional branches (Africa, West/South Asia, East/Southeast Asia, Europe, Americas, Oceania) with unique traits and units.
- **Hexagonal Supply Line Mechanics:**
  - Armies cut off from territory or allied supply lines suffer starvation, attrition, and severe combat debuffs (press `L` to toggle live supply overlays).
- **Social Strata & Politics:**
  - Populations divided into Farmers, Craftsmen, and Scholars with modifiable social focus policies, civic assemblies, and trade surplus markets.
- **Headless Deterministic Simulation Core:**
  - A decoupled C# core (`Core/`) that runs independent of Unity GameObjects, allowing CLI batch testing and simulation verification in under 5 seconds.

---

## 🛠️ Tech Stack & Architecture
- **Engine:** Unity 6.3 LTS.
- **Language:** C# 12.
- **AI Tooling:** Claude Code agentic runner + OpenAI Codex integration.

---

## 📋 How to Clone & Run

```bash
git clone https://github.com/kanta13jp1/HexCiv.git
```

- **In Unity:** Open in Unity 6.3 LTS, open `Assets/Scenes/Main.unity`, and press Play.
- **Headless Smoke Test:**
  ```powershell
  & "C:\Program Files\Unity\Hub\Editor\6000.3.20f1\Editor\Unity.exe" -batchmode -nographics -quit -projectPath . -executeMethod SmokeTest.Run
  ```
