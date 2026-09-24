/**
 * BUILDERMENT 3D - MASTER APPLICATION & GAME LOOP
 */

class BuildermentApp {
    constructor() {
        this.engine = window.renderEngine;
        this.sim = null;
        this.world = null;
        this.tech = null;
        this.ui = null;

        this.isDragging = false;
        this.lastDragGx = null;
        this.lastDragGz = null;

        this.hoverCursor = null;
    }

    start() {
        // 1. Initialize 3D Engine
        this.engine.init();

        // 2. Initialize World & Simulation
        this.world = new window.WorldGenerator(this.engine.scene, 2);
        this.world.generateWorld();

        this.sim = new window.FactorySimulation(this.engine.scene, 2);
        this.tech = new window.TechTreeManager(this.sim);
        this.ui = new window.UIManager(this.sim, this.tech, this.world, this.engine);
        window.uiManager = this.ui;

        // 3. Create 3D Hover Cursor
        this.createHoverCursor();

        // 4. Bind Mouse & Touch Interaction
        this.bindInteractions();

        // 5. Load Saved Game (if exists)
        this.loadGame();
        this.ui.refreshToolLocks();

        // 6. Start Game Loop & Auto-Save
        this.animate();
        setInterval(() => this.saveGame(), 10000);
        window.addEventListener('beforeunload', () => this.saveGame());

        this.ui.showToast("🚀 Willkommen bei Forgefront! Verbinde einen Bohrer mit dem Orbitaltresor.");
    }

    createHoverCursor() {
        const cursorGeo = new THREE.BoxGeometry(1.94, 0.12, 1.94);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
        this.hoverCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.hoverCursor.visible = false;
        this.engine.scene.add(this.hoverCursor);

        const arrowGeo = new THREE.ConeGeometry(0.35, 0.8, 4);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
        arrowMesh.position.y = 0.35;
        this.hoverCursor.add(arrowMesh);
    }

    bindInteractions() {
        const canvas = this.engine.canvas;

        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Touch support for mobile / tablets
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.onMouseMove(e.touches[0]);
            }
        });
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.onMouseDown(e.touches[0]);
            }
        });
        window.addEventListener('touchend', (e) => this.onMouseUp(e));
    }

    onMouseMove(e) {
        const hit = this.engine.getGridIntersection(e.clientX, e.clientY);
        if (!hit) {
            this.hoverCursor.visible = false;
            return;
        }

        const { gx, gz } = hit;
        this.hoverCursor.visible = Math.abs(gx) <= 20 && Math.abs(gz) <= 20;
        this.hoverCursor.position.set(gx * 2, 0.05, gz * 2);
        this.hoverCursor.rotation.y = DIRS[this.ui.currentDir].angle;

        // Continuous Drag-and-Build for Belts
        if (this.isDragging && this.ui.selectedTool === 'belt') {
            if (this.lastDragGx !== null && (gx !== this.lastDragGx || gz !== this.lastDragGz)) {
                // Auto-calculate direction based on mouse drag vector
                const dx = gx - this.lastDragGx;
                const dz = gz - this.lastDragGz;
                let dragDir = this.ui.currentDir;

                if (Math.abs(dx) > Math.abs(dz)) {
                    dragDir = dx > 0 ? 0 : 2; // EAST or WEST
                } else if (dz !== 0) {
                    dragDir = dz > 0 ? 1 : 3; // SOUTH or NORTH
                }

                this.placeBuildingAt(gx, gz, dragDir);
                this.lastDragGx = gx;
                this.lastDragGz = gz;
            }
        }
    }

    onMouseDown(e) {
        if (e.button !== 0 && e.button !== undefined) return; // Left mouse only
        const hit = this.engine.getGridIntersection(e.clientX, e.clientY);
        if (!hit) return;

        const { gx, gz } = hit;
        this.isDragging = true;
        this.lastDragGx = gx;
        this.lastDragGz = gz;

        this.handleGridClick(gx, gz);
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.lastDragGx = null;
        this.lastDragGz = null;
    }

    handleGridClick(gx, gz) {
        const key = `${gx},${gz}`;
        const tool = this.ui.selectedTool;

        // 1. Demolish Tool
        if (tool === 'demolish') {
            const b = this.sim.buildings.get(key);
            if (b && !b.isVault) {
                this.sim.removeBuilding(gx, gz);
                this.sim.gold += Math.floor((b.cost || 10) * 0.75);
                if (window.soundEngine) window.soundEngine.playDemolish();
                this.ui.showToast("🗑️ Gebäude abgerissen (+10 Gold)");
            }
            return;
        }

        // 2. Click Existing Building -> Inspect
        if (this.sim.buildings.has(key)) {
            const b = this.sim.buildings.get(key);
            if (b.isVault) {
                this.ui.showToast("🏰 Zentraler Gold-Tresor: Liefert Waren hierher für Gold!");
                return;
            }
            if (tool === 'belt' && b.type === 'belt') {
                // Clicking existing belt rotates it
                b.dir = (b.dir + 1) % 4;
                b.mesh.rotation.y = DIRS[b.dir].angle;
                if (window.soundEngine) window.soundEngine.playPlaceBelt();
                return;
            }
            this.ui.openInspector(b);
            if (window.soundEngine) window.soundEngine.playClick();
            return;
        }

        // 3. Place Building
        this.placeBuildingAt(gx, gz, this.ui.currentDir);
    }

    placeBuildingAt(gx, gz, dir) {
        const key = `${gx},${gz}`;
        const tool = this.ui.selectedTool;
        if (this.sim.buildings.has(key)) return;

        const costs = {
            belt: 1, underground: 15, splitter: 25, extractor: 10,
            furnace: 20, workshop: 20, forge: 150,
            machine_shop: 100, industrial_factory: 500, manufacturer: 2000,
            earth_teleporter: 5000, gem_tree: 10000
        };

        const cost = costs[tool] || 1;
        if (!this.tech.isToolUnlocked(tool) && !['splitter'].includes(tool)) {
            this.ui.showToast('🔒 Dieses Gebäude muss zuerst erforscht werden.');
            return;
        }
        if (tool === 'splitter' && !this.tech.isUnlocked('mechanics_gears')) {
            this.ui.showToast('🔒 Benötigt Präzisionsmechanik.');
            return;
        }
        if (tool === 'earth_teleporter' && !this.tech.isUnlocked('earth_token_project')) {
            this.ui.showToast('🔒 Benötigt die Earth-Token-Synthese.');
            return;
        }
        if (this.sim.gold < cost) {
            this.ui.showToast(`❌ Nicht genug Gold (🪙 ${cost} benötigt)!`);
            return;
        }

        if (tool === 'extractor') {
            if (!this.world.deposits.has(key)) {
                this.ui.showToast("⚠️ Bohrer müssen auf einer Erzader oder Holzvorkommen platziert werden!");
                return;
            }
        }

        this.sim.gold -= cost;
        const b = this.sim.addBuilding(tool, gx, gz, dir);
                if (b) b.cost = cost;

        if (tool === 'belt') {
            if (window.soundEngine) window.soundEngine.playPlaceBelt();
        } else {
            if (window.soundEngine) window.soundEngine.playBuildMachine();
            this.ui.showToast(`✨ ${tool.toUpperCase()} erfolgreich gebaut!`);
        }
    }

    // ----------------------------------------------------
    // SAVE & LOAD (LOCALSTORAGE)
    // ----------------------------------------------------

    saveGame() {
        const buildingsData = [];
        this.sim.buildings.forEach(b => {
            if (!b.isVault) {
                buildingsData.push({
                    type: b.type,
                    gx: b.gx,
                    gz: b.gz,
                    dir: b.dir,
                    level: b.level,
                    activeRecipeId: b.activeRecipe ? b.activeRecipe.id : null,
                                        inventory: b.inventory,
                                        cost: b.cost
                });
            }
        });

        const saveData = {
            gold: this.sim.gold,
            totalDelivered: this.sim.totalDelivered,
            totalGoldEarned: this.sim.totalGoldEarned,
            conveyorTier: this.sim.conveyorTier,
            techs: this.tech.techs,
            producedCounts: this.sim.producedCounts,
            deliveredCounts: this.sim.deliveredCounts,
            victoryAchieved: this.sim.victoryAchieved,
            buildings: buildingsData
        };

        localStorage.setItem('builderment3d_save', JSON.stringify(saveData));
    }

    loadGame() {
        const raw = localStorage.getItem('builderment3d_save');
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            this.sim.gold = data.gold || 250;
            this.sim.totalDelivered = data.totalDelivered || 0;
            this.sim.totalGoldEarned = data.totalGoldEarned || 0;
            this.sim.conveyorTier = data.conveyorTier || 1;
            if (data.techs) this.tech.techs = data.techs;
            this.sim.producedCounts = data.producedCounts || {};
            this.sim.deliveredCounts = data.deliveredCounts || {};
            this.sim.victoryAchieved = data.victoryAchieved === true;

            if (data.buildings && Array.isArray(data.buildings)) {
                data.buildings.forEach(b => {
                    const recipes = MACHINE_RECIPES[b.type] || [];
                    const savedRecipe = recipes.find(recipe => recipe.id === b.activeRecipeId) || null;
                    const built = this.sim.addBuilding(b.type, b.gx, b.gz, b.dir, savedRecipe);
                    if (built) {
                        built.inventory = b.inventory || {};
                        built.cost = b.cost || 0;
                    }
                    if (built && b.level > 1) {
                        built.level = b.level;
                        built.speedMultiplier = 1.0 + (b.level - 1) * 0.5;
                    }
                });
            }
        } catch (e) {
            console.error("Error loading save:", e);
        }
    }

    // ----------------------------------------------------
    // MAIN GAME ANIMATION TICK (60 FPS)
    // ----------------------------------------------------

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.engine.clock.getDelta();
        const elapsed = this.engine.clock.getElapsedTime();

        // 1. Update World Animations (Tree swaying, Citadel coins)
        this.world.animate(elapsed);

        // 2. Update Factory Simulation (Extractors, Belts, Crafting)
        this.sim.update(delta, this.world.deposits, this.engine);

        // 3. Update Particles
        this.engine.updateParticles(delta);

        // 4. Update UI HUD
        this.ui.updateHUD();

        // 5. Update Camera Controls & Render
        this.engine.controls.update();
        this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const app = new BuildermentApp();
    window.gameApp = app;
    app.start();
});
