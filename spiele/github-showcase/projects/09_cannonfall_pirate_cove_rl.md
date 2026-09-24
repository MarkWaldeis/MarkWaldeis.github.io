# 🏴‍☠️ Cannonfall — 3D Pirate Cove Buoyancy Sim with In-Browser Reinforcement Learning

> **Category:** 3D Pirate / Naval Physics & AI Simulation  
> **Repository:** [coltonomous/cannonfall](https://github.com/coltonomous/cannonfall)  
> **Developer / Author:** Colton Allen (`coltonomous`)  
> **License:** Open Source  
> **Stars:** Small account (0 stars)  
> **Tech Stack:** Three.js, cannon-es (physics), ONNX Web Runtime (RL AI)  

---

## 🌟 Project Overview
**Cannonfall** is a 3D physics-driven naval action simulation featuring a dedicated **Pirate Cove** game mode. It combines realistic ocean wave buoyancy calculations with an in-browser **Reinforcement Learning (RL) agent** that learns how to steer pirate galleons, calibrate broadside cannon elevation, and anticipate wave pitch and roll.

---

## 🎮 Key Features & Mechanics
- **Dynamic Wave Buoyancy Solver:**
  - Multi-sample hull buoyancy: calculates hydrostatic lift across multiple hull points to simulate realistic ship rocking, pitching, and wave crest breaching.
  - Wave crest foam rendering and dynamic sea state parameters.
- **Tactical Cannon Combat:**
  - Ballistic projectile physics with wind drift and ocean wave height interference.
  - Port and starboard broadside volleys with individual cannon reload cooldowns.
- **In-Browser Machine Learning (ONNX):**
  - Uses ONNX Web Runtime to run trained reinforcement learning neural network models directly inside the browser, powering intelligent enemy pirate captains.

---

## 🛠️ Tech Stack & Architecture
- **Graphics:** Three.js with custom GLSL ocean wave shaders.
- **Physics:** `cannon-es` rigid-body physics engine.
- **AI & ML:** ONNX Runtime Web (`onnxruntime-web`) for neural network inference.
- **Language:** Modern JavaScript (ES Modules).

---

## 📋 How to Clone & Run

```bash
git clone https://github.com/coltonomous/cannonfall.git
cd cannonfall
npm install
npm run dev
```

Open your browser at `http://localhost:5173` to test ship sailing physics and AI broadsides.
