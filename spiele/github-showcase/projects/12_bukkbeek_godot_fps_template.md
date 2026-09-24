# 🔫 Godot 4 3D FPS & Vehicle Template — Indie Game Foundation

> **Category:** 3D FPS / Godot 4 Indie Architecture  
> **Repository:** [bukkbeek/GodotFPS-Template](https://github.com/bukkbeek/GodotFPS-Template)  
> **Developer / Author:** `bukkbeek`  
> **License:** MIT License  
> **Stars:** Small account (60 stars)  
> **Engine:** Godot Engine 4.x (GDScript)  

---

## 📸 In-Game Screenshots

| Godot 4 FPS Arsenal, Drivable Jeep & Zombie AI |
| :---: |
| ![Godot 4 FPS Banner](../screenshots/godot4-fps/banner.png) |

---

## 🌟 Project Overview
**GodotFPS-Template** is a clean, modular 3D first-person shooter template built in Godot 4. It provides solo developers with a complete starter kit that includes smooth character movement, an inventory and weapon swapping system, drivable 4x4 vehicles with suspension physics, and enemy AI navigation.

---

## 🎮 Key Features & Mechanics
- **First-Person Controller:**
  - Smooth mouse look, sprint, crouch, jump, head bobbing, and footstep sound triggers.
  - Weapon sway, recoil kick, and reload animations.
- **Drivable 4-Wheel Vehicles:**
  - Godot 4 `VehicleBody3D` and `VehicleWheel3D` setup for a drivable Jeep with functional suspension, steering, and entering/exiting mechanics.
- **Zombie / Enemy AI:**
  - Godot 4 `NavigationAgent3D` pathfinding that dynamically stalks the player, navigates around obstacles, and attacks when within range.
- **Arsenal:**
  - Fully implemented pistol, assault rifle, shotgun, and grenades with raycast hit detection and impact decals.

---

## 🛠️ Tech Stack & Architecture
- **Engine:** Godot 4.x.
- **Scripting:** GDScript 2.0 with modular component nodes.
- **Physics:** Jolt Physics / Godot Physics 3D.

---

## 📋 How to Clone & Run

```bash
git clone https://github.com/bukkbeek/GodotFPS-Template.git
```

Open the folder in **Godot 4**, open `Scenes/Main.tscn`, and press **F5** to play.
