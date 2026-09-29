/**
 * FORGEFRONT 3D - MASTER APPLICATION & GAME LOOP
 */

const SAVE_KEY = 'forgefront_save_v2';
const LEGACY_SAVE_KEY = 'builderment3d_save';

class BuildermentApp {
    constructor() {
        this.engine = window.renderEngine;
        this.sim = null;
        this.world = null;
        this.tech = null;
        this.ui = null;
        this.contracts = null;

        this.state = 'boot';   // boot -> menu -> playing (paused flag extra)
        this.paused = false;
        this.playSeconds = 0;  // active playtime for stats & victory screen

        this.isDragging = false;
        this.lastDragGx = null;
        this.lastDragGz = null;

        this.hoverCursor = null;
        this.hoverKey = null;      // grid key currently under the mouse
        this.ghost = null;         // translucent placement preview mesh
        this.ghostKey = null;      // "tool:dir" the ghost was built for
        this.ghostMat = null;
        this.keysDown = new Set(); // WASD / arrows / QE camera keys
        this._autosaveTimer = null;
    }

    toolCost(tool) {
        const costs = {
            belt: 1, underground: 15, splitter: 25, extractor: 10,
            furnace: 20, workshop: 20, forge: 150,
            machine_shop: 100, industrial_factory: 500, manufacturer: 2000,
            earth_teleporter: 5000, gem_tree: 10000
        };
        return costs[tool] || 1;
    }

    /** Shared placement-validity check used by ghost preview and actual placement. */
    canPlaceAt(gx, gz, tool = this.ui.selectedTool) {
        if (Math.abs(gx) > 20 || Math.abs(gz) > 20) return { ok: false, reason: '⚠️ Ausserhalb des Baubereichs.' };
        if (this.sim.buildings.has(`${gx},${gz}`)) return { ok: false, reason: 'occupied' };
        if (tool === 'extractor' && !this.world.deposits.has(`${gx},${gz}`)) {
            return { ok: false, reason: '⚠️ Bohrer müssen auf einer Erzader oder Holzvorkommen platziert werden!' };
        }
        if (tool === 'splitter') {
            if (!this.tech.isUnlocked('mechanics_gears')) return { ok: false, reason: '🔒 Benötigt Präzisionsmechanik.' };
        } else if (tool === 'earth_teleporter') {
            if (!this.tech.isUnlocked('earth_token_project')) return { ok: false, reason: '🔒 Benötigt die Earth-Token-Synthese.' };
        } else if (!this.tech.isToolUnlocked(tool)) {
            return { ok: false, reason: '🔒 Dieses Gebäude muss zuerst erforscht werden.' };
        }
        const cost = this.toolCost(tool);
        if (this.sim.gold < cost) return { ok: false, reason: `❌ Nicht genug Gold (🪙 ${cost} benötigt)!` };
        return { ok: true };
    }

    async start() {
        // 1. Initialize 3D Engine
        this.engine.init();
        this.bindMenuControls();

        // 2. Load Blender-built GLB models (falls back to procedural silently)
        const statusEl = document.getElementById('menu-load-status');
        const modelNames = ['extractor', 'furnace', 'workshop', 'forge', 'machine_shop',
            'industrial_factory', 'manufacturer', 'earth_teleporter', 'gem_tree', 'vault', 'ore_boulder'];
        let loadedCount = 0;
        if (window.modelLib) {
            loadedCount = await window.modelLib.load(modelNames);
        }
        if (statusEl) {
            statusEl.classList.add('ok');
            statusEl.textContent = loadedCount > 0
                ? `✔ ${loadedCount}/${modelNames.length} Fabrikmodule geladen`
                : '✔ Prozedurale Fabrikmodule aktiv';
        }

        // 3. Initialize World & Simulation
        this.world = new window.WorldGenerator(this.engine.scene, 2);
        this.world.generateWorld();

        this.sim = new window.FactorySimulation(this.engine.scene, 2);
        this.sim.deposits = this.world.deposits;
        this.tech = new window.TechTreeManager(this.sim);
        this.contracts = new window.ContractManager(this.sim, this.tech);
        this.ui = new window.UIManager(this.sim, this.tech, this.world, this.engine);
        window.uiManager = this.ui;

        // 4. Create 3D Hover Cursor & bind input
        this.createHoverCursor();
        this.bindInteractions();

        // 5. Load Saved Game (if exists)
        const hadSave = this.loadGame();
        this.ui.refreshToolLocks();
        this.refreshMenuButtons(hadSave);

        // 6. Start Game Loop & Auto-Save
        this.animate();
        this._autosaveTimer = setInterval(() => {
            if (this.state === 'playing' && !this.paused) this.saveGame();
        }, 10000);
        window.addEventListener('beforeunload', () => {
            if (this.state === 'playing') this.saveGame();
        });

        // Skip straight into the game when "Neue Fabrik" requested a reload-free fresh start
        if (sessionStorage.getItem('ff_autostart') === '1') {
            sessionStorage.removeItem('ff_autostart');
            this.enterGame();
            return;
        }
        this.state = 'menu';
        document.body.classList.add('in-menu');
    }

    // ----------------------------------------------------
    // MENU / PAUSE / VICTORY FLOW
    // ----------------------------------------------------

    refreshMenuButtons(hadSave) {
        const cont = document.getElementById('menu-continue');
        const fresh = document.getElementById('menu-new');
        if (cont) cont.style.display = hadSave ? '' : 'none';
        if (fresh) fresh.innerHTML = hadSave ? '🏭 Neue Fabrik (Spielstand löschen)' : '🏭 Fabrik aufbauen';
    }

    enterGame() {
        if (!this.sim || !this.ui) return; // still loading
        this.state = 'playing';
        this.paused = false;
        document.body.classList.remove('in-menu');
        document.body.classList.remove('is-paused');
        document.getElementById('menu-overlay').classList.remove('active');
        document.getElementById('pause-overlay').classList.remove('active');
        document.getElementById('help-overlay').classList.remove('active');
        this.engine.resetCameraToVault();
        this.ui.showToast(this.sim.totalDelivered > 0
            ? '🏭 Willkommen zurück — die Fabrik läuft weiter.'
            : '🚀 Verbinde einen Bohrer über Förderbänder mit dem goldenen Tresor!');
    }

    togglePause() {
        if (this.state !== 'playing') return;
        this.setPaused(!this.paused);
    }

    setPaused(on) {
        if (this.state !== 'playing') return;
        this.paused = on;
        document.body.classList.toggle('is-paused', on);
        document.getElementById('pause-overlay').classList.toggle('active', on);
        if (on) this.saveGame();
    }

    onVictory() {
        // gold fountain burst at the vault
        for (let i = 0; i < 30; i++) {
            setTimeout(() => this.engine.spawnSparks(0, 4 + Math.random() * 2, 0), i * 40);
        }
        if (window.soundEngine) window.soundEngine.playVictory();
        const fmtTime = s => {
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
            return h > 0 ? `${h}h ${m}m` : `${m}:${String(Math.floor(s % 60)).padStart(2, '0')} min`;
        };
        document.getElementById('v-time').innerText = fmtTime(this.playSeconds);
        document.getElementById('v-delivered').innerText = this.sim.totalDelivered.toLocaleString('de-DE');
        document.getElementById('v-gold').innerText = `🪙 ${Math.floor(this.sim.totalGoldEarned).toLocaleString('de-DE')}`;
        document.getElementById('v-buildings').innerText = Math.max(0, this.sim.buildings.size - 9);
        document.getElementById('victory-overlay').classList.add('active');
        this.saveGame();
    }

    /** Wipes the save and rebuilds an empty factory — no reload needed. */
    resetFactory() {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(LEGACY_SAVE_KEY);

        // remove all non-vault buildings (also reveals covered deposits)
        const keys = [...this.sim.buildings.keys()];
        keys.forEach(k => {
            const b = this.sim.buildings.get(k);
            if (b && !b.isVault) this.sim.removeBuilding(b.gx, b.gz);
        });
        // drop in-flight items back to the pool
        this.sim.itemsOnBelts.forEach(it => this.sim._recycleItemMesh(it.mesh));
        this.sim.itemsOnBelts.length = 0;

        // economy & progress reset
        this.sim.gold = 250;
        this.sim.totalDelivered = 0;
        this.sim.totalGoldEarned = 0;
        this.sim.goldPerMin = 0;
        this.sim.itemsPerMin = 0;
        this.sim.goldRecentHistory = [];
        this.sim.itemsRecentHistory = [];
        this.sim.producedCounts = {};
        this.sim.deliveredCounts = {};
        this.sim.victoryAchieved = false;
        this.sim.conveyorTier = 1;
        this.sim.extractorTier = 1;
        this.playSeconds = 0;

        this.tech.techs = []; // setter rebuilds defaults
        this.contracts = new window.ContractManager(this.sim, this.tech);
        if (this.ui) {
            this.ui.victoryShown = false;
            this.ui._contractSig = null;
            this.ui.refreshToolLocks();
            this.ui.closeAllModals();
        }
        document.getElementById('victory-overlay').classList.remove('active');
        this.engine.resetCameraToVault();
    }

    bindMenuControls() {
        const $ = id => document.getElementById(id);
        $('menu-continue').addEventListener('click', () => { if (window.soundEngine) window.soundEngine.playClick(); this.enterGame(); });
        $('menu-new').addEventListener('click', () => {
            if (window.soundEngine) window.soundEngine.playClick();
            if (!this.sim || !this.ui) return;
            const hasSave = Boolean(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY));
            const hasFactory = this.sim.buildings.size > 9;
            if (hasSave && hasFactory) {
                if (!confirm('Vorhandene Fabrik wird zurückgesetzt. Wirklich neu starten?')) return;
                this.resetFactory();
                this.saveGame();
            }
            this.enterGame();
        });
        $('menu-help').addEventListener('click', () => { if (window.soundEngine) window.soundEngine.playClick(); $('help-overlay').classList.add('active'); });
        $('help-close').addEventListener('click', () => { if (window.soundEngine) window.soundEngine.playClick(); $('help-overlay').classList.remove('active'); });

        $('pause-resume').addEventListener('click', () => { if (window.soundEngine) window.soundEngine.playClick(); this.setPaused(false); });
        $('pause-save').addEventListener('click', () => { this.saveGame(); if (window.soundEngine) window.soundEngine.playClick(); this.ui.showToast('💾 Spielstand gespeichert.'); });
        $('pause-settings').addEventListener('click', () => { this.setPaused(false); this.ui.openModal('settings-modal'); });
        $('pause-menu').addEventListener('click', () => { this.saveGame(); location.reload(); });

        $('victory-continue').addEventListener('click', () => {
            document.getElementById('victory-overlay').classList.remove('active');
            if (window.soundEngine) window.soundEngine.playClick();
        });
        $('victory-new').addEventListener('click', () => {
            if (confirm('Kampagne abgeschlossen! Neue Fabrik auf leerem Feld starten?')) {
                this.resetFactory();
                document.getElementById('victory-overlay').classList.remove('active');
            }
        });
        $('btn-back-to-menu').addEventListener('click', () => { this.saveGame(); location.reload(); });
    }

    createHoverCursor() {
        const cursorGeo = new THREE.BoxGeometry(1.94, 0.12, 1.94);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
        this.hoverCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.hoverCursor.visible = false;
        this.engine.scene.add(this.hoverCursor);

        const arrowGeo = new THREE.ConeGeometry(0.35, 0.8, 4);
        arrowGeo.rotateZ(-Math.PI / 2); // apex along local +X
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
        arrowMesh.position.y = 0.35;
        this.hoverCursor.add(arrowMesh);
    }

    /** (Re)builds the translucent ghost preview for the current tool + direction. */
    refreshGhost() {
        const tool = this.ui.selectedTool;
        const dir = this.ui.currentDir;
        const key = `${tool}:${dir}`;
        if (this.ghostKey === key) return;
        this.ghostKey = key;

        if (this.ghost) {
            this.engine.scene.remove(this.ghost);
            this.ghost.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
            this.ghost = null;
        }
        if (!tool || tool === 'demolish') return;
        if (!this.ghostMat) {
            this.ghostMat = new THREE.MeshBasicMaterial({
                color: 0x34d399, transparent: true, opacity: 0.42, depthWrite: false
            });
        }

        let mesh = null;
        if (tool === 'belt') mesh = this.sim.createBeltMesh(0, 0, dir);
        else if (tool === 'underground') mesh = this.sim.createUndergroundMesh(0, 0, dir);
        else if (tool === 'splitter') mesh = this.sim.createSplitterMesh(0, 0, dir);
        else if (tool === 'extractor') mesh = this.sim.createExtractorMesh(0, 0, dir);
        else if (tool === 'gem_tree') mesh = this.sim.createGemTreeMesh(0, 0, dir);
        else mesh = this.sim.createMachineMesh(tool, 0, 0, dir);
        if (!mesh) return;

        // Strip progress bar & override materials with ghost tint
        const bar = mesh.getObjectByName('progressBar');
        if (bar) mesh.remove(bar);
        mesh.traverse(o => {
            if (o.isMesh) {
                o.material = this.ghostMat;
                o.castShadow = false;
                o.receiveShadow = false;
            }
        });
        mesh.visible = false;
        this.ghost = mesh;
    }

    /** Position + tint the ghost and hover cursor for the hovered cell. */
    updateGhostAt(gx, gz) {
        this.refreshGhost();
        const tool = this.ui.selectedTool;
        const inBounds = Math.abs(gx) <= 20 && Math.abs(gz) <= 20;

        if (this.ghost) {
            const check = this.canPlaceAt(gx, gz, tool);
            this.ghost.visible = inBounds && !this.sim.buildings.has(`${gx},${gz}`);
            this.ghost.position.set(gx * 2, 0, gz * 2);
            if (this.ghostMat) this.ghostMat.color.setHex(check.ok ? 0x34d399 : 0xf43f5e);
        }

        // Hover cursor tint: cyan normally, red for demolish / invalid
        if (this.hoverCursor) {
            let color = 0x38bdf8;
            if (tool === 'demolish') {
                const b = this.sim.buildings.get(`${gx},${gz}`);
                color = (b && !b.isVault) ? 0xf43f5e : 0x64748b;
            } else if (!this.canPlaceAt(gx, gz, tool).ok) {
                color = 0xf43f5e;
            }
            this.hoverCursor.material.color.setHex(color);
        }
    }

    bindInteractions() {
        const canvas = this.engine.canvas;

        // NOTE: OrbitControls preventDefaults pointerdown, which suppresses the
        // mousedown/mouseup compatibility events — Pointer Events are required here
        // (they also transparently cover touch & pen input).
        canvas.addEventListener('pointermove', (e) => this.onMouseMove(e));
        canvas.addEventListener('pointerdown', (e) => this.onMouseDown(e));
        window.addEventListener('pointerup', (e) => this.onMouseUp(e));

        // User grabbing the camera cancels scripted camera flights
        canvas.addEventListener('pointerdown', () => this.engine.cancelCameraAnim());
        canvas.addEventListener('wheel', () => this.engine.cancelCameraAnim(), { passive: true });

        // WASD / arrows pan, Q/E rotate
        window.addEventListener('keydown', (e) => this.onCameraKey(e, true));
        window.addEventListener('keyup', (e) => this.onCameraKey(e, false));
        window.addEventListener('blur', () => {
            this.keysDown.clear();
            this.applyCameraKeys();
        });
    }

    onCameraKey(e, down) {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = e.key.toLowerCase();
        const camKeys = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
        if (!camKeys.includes(k)) return;
        if (down && e.repeat) return;
        if (down) this.keysDown.add(k);
        else this.keysDown.delete(k);
        this.applyCameraKeys();
        if (k.startsWith('arrow')) e.preventDefault();
    }

    applyCameraKeys() {
        const k = this.keysDown;
        const v = this.engine.panVelocity;
        v.x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
        v.y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
        this.engine.rotVelocity = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
    }

    onMouseMove(e) {
        if (e.isPrimary === false) return; // ignore secondary touch points
        const hit = this.engine.getGridIntersection(e.clientX, e.clientY);
        if (!hit) {
            this.hoverCursor.visible = false;
            this.hoverKey = null;
            if (this.ghost) this.ghost.visible = false;
            return;
        }

        const { gx, gz } = hit;
        this.hoverKey = `${gx},${gz}`;
        this.hoverCursor.visible = Math.abs(gx) <= 20 && Math.abs(gz) <= 20;
        this.hoverCursor.position.set(gx * 2, 0.05, gz * 2);
        this.hoverCursor.rotation.y = DIRS[this.ui.currentDir].angle;
        this.updateGhostAt(gx, gz);

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
        if (e.isPrimary === false) return; // second finger = camera pinch, not building
        if (e.button !== 0 && e.button !== undefined) return; // Left mouse / touch only
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
                const refund = Math.floor((b.cost || 10) * 0.75);
                this.sim.gold += refund;
                if (window.soundEngine) window.soundEngine.playDemolish();
                this.ui.showToast(`🗑️ Gebäude abgerissen (+${refund} Gold)`);
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

        const check = this.canPlaceAt(gx, gz, tool);
        if (!check.ok) {
            if (check.reason !== 'occupied') this.ui.showToast(check.reason);
            return;
        }

        const cost = this.toolCost(tool);
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
            version: 2,
            gold: this.sim.gold,
            totalDelivered: this.sim.totalDelivered,
            totalGoldEarned: this.sim.totalGoldEarned,
            conveyorTier: this.sim.conveyorTier,
            techs: this.tech.techs,
            producedCounts: this.sim.producedCounts,
            deliveredCounts: this.sim.deliveredCounts,
            victoryAchieved: this.sim.victoryAchieved,
            contracts: this.contracts ? this.contracts.serialize() : null,
            playSeconds: Math.floor(this.playSeconds),
            savedAt: Date.now(),
            buildings: buildingsData
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    }

    loadGame() {
        // Current key first, legacy key as fallback (then migrated on next save)
        const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
        if (!raw) return false;

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
            this.playSeconds = data.playSeconds || 0;
            if (this.contracts && typeof this.contracts.restore === 'function') {
                this.contracts.restore(data.contracts);
            }
            // A completed campaign must not re-trigger the victory ceremony after reload
            if (this.ui) this.ui.victoryShown = this.sim.victoryAchieved;

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
            return true;
        } catch (e) {
            console.error("Error loading save:", e);
            return false;
        }
    }

    // ----------------------------------------------------
    // MAIN GAME ANIMATION TICK (60 FPS)
    // ----------------------------------------------------

    animate() {
        requestAnimationFrame(() => this.animate());

        const rawDelta = this.engine.clock.getDelta();
        const delta = Math.min(rawDelta, 0.1); // clamp: no teleporting items after tab-switch
        const elapsed = this.engine.clock.getElapsedTime();

        // 0. Keyboard camera (WASD pan, Q/E rotate) + keep ghost in sync with tool/dir
        this.engine.updateKeyboardPan(delta);
        this.engine.updateKeyboardRotate(delta);
        this.refreshGhost();

        // 1. Update World Animations (Tree swaying, Citadel coins)
        this.world.animate(elapsed);

        // 2. Update Factory Simulation (Extractors, Belts, Crafting) — frozen while paused;
        //    keeps running behind the main menu as a live backdrop (not saved there).
        if (!this.paused && this.state !== 'boot') {
            this.sim.update(delta, this.world.deposits, this.engine);
            if (this.state === 'playing') {
                this.playSeconds += delta;
                if (this.contracts) this.contracts.update(delta);
            }
        }

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
