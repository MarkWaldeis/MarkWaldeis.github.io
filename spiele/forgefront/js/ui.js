/**
 * BUILDERMENT 3D - USER INTERFACE & MODAL CONTROLLER
 */

class UIManager {
    constructor(simulation, techTree, worldGen, renderEngine) {
        this.sim = simulation;
        this.tech = techTree;
        this.world = worldGen;
        this.engine = renderEngine;

        this.activeModal = null;
        this.selectedTool = 'belt';
        this.currentDir = 0; // 0: EAST, 1: SOUTH, 2: WEST, 3: NORTH

        this.initEventListeners();
        this.refreshToolLocks();
        this.lastHudUpdate = 0;
        this.victoryShown = false;
    }

    initEventListeners() {
        // Tool buttons in Bottom Dock
        document.querySelectorAll('.tool-card[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Rotate Action
        document.getElementById('action-rotate').addEventListener('click', () => {
            this.rotate();
            if (window.soundEngine) window.soundEngine.playClick();
        });

        // Topbar Control Buttons
        document.getElementById('btn-camera-iso').addEventListener('click', () => {
            this.engine.toggleIsometric();
            if (window.soundEngine) window.soundEngine.playClick();
        });

        document.getElementById('btn-camera-center').addEventListener('click', () => {
            this.engine.resetCameraToVault();
            if (window.soundEngine) window.soundEngine.playClick();
        });

        document.getElementById('btn-tech-tree').addEventListener('click', () => {
            this.openModal('tech-modal');
            this.renderTechTree();
            if (window.soundEngine) window.soundEngine.playClick();
        });

        document.getElementById('btn-codex').addEventListener('click', () => {
                    this.openModal('codex-modal');
                    this.renderCodex();
                    if (window.soundEngine) window.soundEngine.playClick();
                });

                document.getElementById('codex-search').addEventListener('input', (event) => this.renderCodex(event.target.value));

                document.getElementById('btn-stats').addEventListener('click', () => {
            this.openModal('stats-modal');
            this.renderStats();
            if (window.soundEngine) window.soundEngine.playClick();
        });

        document.getElementById('btn-audio').addEventListener('click', () => {
            const enabled = window.soundEngine.toggle();
            document.getElementById('btn-audio').innerText = enabled ? '🔊' : '🔇';
            this.showToast(enabled ? "🔊 Sound aktiviert" : "🔇 Sound stummgeschaltet");
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            this.openModal('settings-modal');
            if (window.soundEngine) window.soundEngine.playClick();
        });

        // Modal Close Buttons
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Inspector Actions
        document.getElementById('inspect-upgrade-btn').addEventListener('click', () => {
            this.upgradeSelectedBuilding();
        });

        document.getElementById('inspect-delete-btn').addEventListener('click', () => {
            this.deleteSelectedBuilding();
        });

        // Settings Actions
        document.getElementById('btn-reset-game').addEventListener('click', () => {
            if (confirm("Möchtest du die Fabrik wirklich komplett zurücksetzen?")) {
                localStorage.removeItem('builderment3d_save');
                window.location.reload();
            }
        });

        document.getElementById('btn-export-save').addEventListener('click', () => {
                    if (window.gameApp) window.gameApp.saveGame();
                    const payload = localStorage.getItem('builderment3d_save') || '{}';
                    const blob = new Blob([payload], { type: 'application/json' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `forgefront-save-${new Date().toISOString().slice(0, 10)}.json`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    this.showToast('💾 Spielstand exportiert.');
                });

                document.getElementById('setting-sound-toggle').addEventListener('click', (event) => {
                    const enabled = window.soundEngine.toggle();
                    event.currentTarget.classList.toggle('active', enabled);
                    event.currentTarget.innerText = enabled ? 'An' : 'Aus';
                });

                document.getElementById('setting-particles-toggle').addEventListener('click', (event) => {
                    this.engine.particlesEnabled = this.engine.particlesEnabled === false;
                    event.currentTarget.classList.toggle('active', this.engine.particlesEnabled);
                    event.currentTarget.innerText = this.engine.particlesEnabled ? 'An' : 'Aus';
                });

                // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') this.rotate();
            else if (e.key === 'x' || e.key === 'X') this.setTool('demolish');
            else if (e.key === '1') this.setTool('belt');
            else if (e.key === '2') this.setTool('underground');
            else if (e.key === '3') this.setTool('extractor');
            else if (e.key === '4') this.setTool('furnace');
            else if (e.key === '5') this.setTool('workshop');
            else if (e.key === '6') this.setTool('forge');
            else if (e.key === '7') this.setTool('machine_shop');
            else if (e.key === '8') this.setTool('industrial_factory');
            else if (e.key === '9') this.setTool('manufacturer');
            else if (e.key === 't' || e.key === 'T') { this.openModal('tech-modal'); this.renderTechTree(); }
            else if (e.key === 's' || e.key === 'S') { this.openModal('stats-modal'); this.renderStats(); }
                        else if (e.key === 'k' || e.key === 'K') { this.openModal('codex-modal'); this.renderCodex(); }
            else if (e.key === 'Escape') this.closeAllModals();
            else if (e.key === ' ') this.engine.resetCameraToVault();
        });
    }

    setTool(tool) {
        this.selectedTool = tool;
        document.querySelectorAll('.tool-card').forEach(btn => {
            if (btn.dataset.tool === tool) btn.classList.add('active');
            else if (btn.dataset.tool) btn.classList.remove('active');
        });
    }

    rotate() {
        this.currentDir = (this.currentDir + 1) % 4;
        const dirName = DIRS[this.currentDir].name;
        document.getElementById('hud-dir-name').innerText = dirName;
        document.getElementById('hud-dir-badge').innerText = dirName;
    }

    openModal(modalId) {
        document.querySelectorAll('.glass-modal').forEach(modal => modal.classList.remove('active'));
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.add('active');
            this.activeModal = m;
        }
    }

    closeAllModals() {
        document.querySelectorAll('.glass-modal').forEach(m => m.classList.remove('active'));
        this.activeModal = null;
        this.sim.selectedBuilding = null;
    }

    // ----------------------------------------------------
    // LIVE HUD UPDATE (CALLED EVERY FRAME)
    // ----------------------------------------------------

    updateHUD() {
        const now = performance.now();
        if (now - this.lastHudUpdate < 120) return;
        this.lastHudUpdate = now;
        document.getElementById('stat-gold').innerText = Math.floor(this.sim.gold);
        document.getElementById('stat-gpm').innerText = this.sim.goldPerMin;
        document.getElementById('stat-ipm').innerText = this.sim.itemsPerMin;

        // Update Inspector if open
        if (this.sim.selectedBuilding) this.updateInspectorLive();
        this.updateObjective();
        if (this.sim.victoryAchieved && !this.victoryShown) {
            this.victoryShown = true;
            this.showToast('🏆 Kampagne abgeschlossen: Der erste Earth Token wurde ausgeliefert!');
        }
    }

    refreshToolLocks() {
        document.querySelectorAll('.tool-card[data-tool]').forEach(button => {
            const tool = button.dataset.tool;
            const specialUnlocked = tool === 'splitter' ? this.tech.isUnlocked('mechanics_gears') :
                tool === 'earth_teleporter' ? this.tech.isUnlocked('earth_token_project') : false;
            button.classList.toggle('locked', !this.tech.isToolUnlocked(tool) && !specialUnlocked);
        });
    }

    updateObjective() {
        const unlocked = this.tech.techs.filter(tech => tech.unlocked).length;
        const computerCount = this.sim.producedCounts.Computer || 0;
        let title, detail, progress;
        if (this.sim.totalDelivered < 10) {
            title = 'Erste Lieferlinie'; detail = `Liefere 10 Rohstoffe an den zentralen Tresor (${this.sim.totalDelivered}/10).`; progress = this.sim.totalDelivered / 10;
        } else if (unlocked < 8) {
            title = 'Industrialisierung'; detail = `Schalte 8 Forschungen frei (${unlocked}/8).`; progress = unlocked / 8;
        } else if (computerCount < 1) {
            title = 'Digitale Fabrik'; detail = 'Produziere den ersten Computer in einer Industriefabrik.'; progress = 0;
        } else if (!this.sim.victoryAchieved) {
            title = 'Projekt Heimkehr'; detail = 'Forsche bis zur Earth-Token-Synthese und liefere einen Earth Token.'; progress = this.tech.isUnlocked('earth_token_project') ? 0.75 : 0.35;
        } else {
            title = 'Kampagne abgeschlossen'; detail = 'Der Planet versorgt die Heimat. Optimiere nun deine Megafabrik.'; progress = 1;
        }
        document.getElementById('objective-title').innerText = title;
        document.getElementById('objective-detail').innerText = detail;
        document.getElementById('objective-progress-fill').style.width = `${Math.min(1, progress) * 100}%`;
    }

    // ----------------------------------------------------
    // BUILDING INSPECTOR DRAWER
    // ----------------------------------------------------

    openInspector(building) {
        this.openModal('inspector-modal');
        this.sim.selectedBuilding = building;

        const icons = {
            extractor: '⛏️', furnace: '🔥', workshop: '🔨',
            forge: '🔩', machine_shop: '⚙️', industrial_factory: '🏭',
            manufacturer: '🔮', earth_teleporter: '🌐', gem_tree: '💎', splitter: '🔀', belt: '➡️', underground: '🚇'
        };

        document.getElementById('inspect-icon').innerText = icons[building.type] || '🏭';
        document.getElementById('inspect-title').innerText = `${building.type.toUpperCase()} (Tier ${building.level})`;
        document.getElementById('inspect-coords').innerText = `Position: (${building.gx}, ${building.gz}) | Richtung: ${DIRS[building.dir].name}`;

        // Render Recipe Options
        const optContainer = document.getElementById('inspect-recipe-options');
        optContainer.innerHTML = '';

        if (building.recipes && building.recipes.length > 0) {
            building.recipes.forEach(rec => {
                const unlocked = this.tech.isRecipeUnlocked(rec.output) || ['Wood Plank', 'Iron Ingot', 'Copper Ingot'].includes(rec.output);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.disabled = !unlocked;
                btn.className = `recipe-opt-btn ${building.activeRecipe && building.activeRecipe.id === rec.id ? 'selected' : ''}`;
                const inputsStr = rec.inputs.map(i => `${i.amount}x ${i.item}`).join(' + ');
                btn.innerHTML = `<span>${unlocked ? '' : '🔒 '}${inputsStr} ➔ <strong>${rec.output}</strong></span> <span>⏱️ ${rec.time}s</span>`;
                btn.addEventListener('click', () => {
                    if (!unlocked) return;
                    building.activeRecipe = rec;
                    building.timer = 0;
                    this.openInspector(building);
                });
                optContainer.appendChild(btn);
            });
        }

        this.updateInspectorLive();
    }

    updateInspectorLive() {
        const b = this.sim.selectedBuilding;
        if (!b) return;

        // Progress Bar
        const fill = document.getElementById('inspect-progress-fill');
        if (fill) fill.style.width = `${(b.progress || 0) * 100}%`;

        // Active Recipe text
        if (b.activeRecipe) {
            const inputsStr = b.activeRecipe.inputs.map(i => `${i.amount}x ${i.item}`).join(' + ');
            document.getElementById('inspect-recipe-flow').innerHTML = `
                <span class="rec-in">${inputsStr}</span>
                <span class="rec-arrow">➔</span>
                <span class="rec-out">${b.activeRecipe.output}</span>
            `;
            document.getElementById('inspect-rate-text').innerText = `${(60 / b.activeRecipe.time * b.speedMultiplier).toFixed(1)} / Min`;
        } else if (b.type === 'extractor' || b.type === 'gem_tree') {
            document.getElementById('inspect-recipe-flow').innerHTML = `<span class="rec-out">${b.type === 'gem_tree' ? 'Züchtet Gem Apples' : 'Fördert Rohstoffe aus Vorkommen'}</span>`;
            document.getElementById('inspect-rate-text').innerText = `${(60 / (b.interval || 3) * b.speedMultiplier).toFixed(1)} / Min`;
        }

        // Inventory Buffers
        const inCount = b.inventory ? Object.values(b.inventory).reduce((a, c) => a + c, 0) : 0;
        document.getElementById('inspect-in-count').innerText = inCount;
        document.getElementById('inspect-out-count').innerText = `${b.speedMultiplier}x Speed`;
        document.getElementById('inspect-upgrade-cost').innerText = b.level >= 4 ? 'MAX' : `🪙 ${b.level * 50}`;
                const badge = document.getElementById('inspect-status-badge');
                const active = (b.progress || 0) > 0;
                badge.innerText = active ? 'Läuft' : 'Wartet';
                badge.className = `status-badge ${active ? 'active' : 'idle'}`;
    }

    upgradeSelectedBuilding() {
        const b = this.sim.selectedBuilding;
        if (!b) return;
        if (b.level >= 4) { this.showToast('✅ Maximale Gebäudestufe erreicht.'); return; }

        const cost = b.level * 50;
        if (this.sim.gold >= cost) {
            this.sim.gold -= cost;
            b.level++;
            b.speedMultiplier += 0.5;
            if (window.soundEngine) window.soundEngine.playUpgrade();
            this.showToast(`⚡ ${b.type.toUpperCase()} auf Tier ${b.level} verbessert!`);
            this.openInspector(b);
        } else {
            this.showToast(`❌ Nicht genug Gold für Upgrade (${cost} benötigt)!`);
        }
    }

    deleteSelectedBuilding() {
        const b = this.sim.selectedBuilding;
        if (!b) return;

        this.sim.removeBuilding(b.gx, b.gz);
        this.sim.gold += Math.floor((b.cost || 10) * 0.75);
        if (window.soundEngine) window.soundEngine.playDemolish();
        this.showToast(`🗑️ Gebäude abgerissen (75 % Rückerstattung)`);
        this.closeAllModals();
    }

    // ----------------------------------------------------
    // TECH TREE MODAL
    // ----------------------------------------------------

    renderTechTree() {
        const grid = document.getElementById('tech-tree-grid');
        grid.innerHTML = '';

        let currentTier = 0;
        this.tech.techs.forEach(t => {
            if (t.tier !== currentTier) {
                currentTier = t.tier;
                const heading = document.createElement('div');
                heading.className = 'tech-tier';
                heading.innerText = `STUFE ${currentTier}`;
                grid.appendChild(heading);
            }
            const missing = this.tech.getMissingPrerequisites(t.id);
            const missingTitles = missing.map(id => this.tech.techs.find(x => x.id === id)?.title || id);
            const card = document.createElement('div');
            card.className = `tech-node-card ${t.unlocked ? 'unlocked' : ''}`;
            card.innerHTML = `
                <span class="tech-title">${t.unlocked ? '✅' : t.icon || '🔒'} ${t.title}</span>
                <p style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">${t.desc}</p>
                ${missing.length ? `<div class="tech-prereq">Benötigt: ${missingTitles.join(', ')}</div>` : ''}
                <div class="tech-cost">Kosten: 🪙 ${t.costGold.toLocaleString('de-DE')} Gold</div>
                <button class="tech-unlock-btn" ${t.unlocked || missing.length ? 'disabled' : ''}>
                    ${t.unlocked ? 'Freigeschaltet' : 'Freischalten'}
                </button>
            `;
            const btn = card.querySelector('.tech-unlock-btn');
            if (!t.unlocked) {
                btn.addEventListener('click', () => {
                    this.tech.unlock(t.id);
                    this.refreshToolLocks();
                });
            }
            grid.appendChild(card);
        });
    }

    // ----------------------------------------------------
    // PRODUCTION CODEX
    // ----------------------------------------------------

    renderCodex(query = '') {
        const list = document.getElementById('codex-list');
        const normalizedQuery = query.trim().toLowerCase();
        const recipesByOutput = new Map((window.GAME_RECIPES || []).map(recipe => [recipe.output_id, recipe]));
        const icons = ['🪨','🔩','⚙️','🧲','🔋','🔬','💠','📦'];
        const filtered = (window.GAME_ITEMS || []).filter(item => {
            const recipe = recipesByOutput.get(item.id);
            return !normalizedQuery || `${item.name} ${item.produced_in} ${recipe?.machine || ''}`.toLowerCase().includes(normalizedQuery);
        });
        list.innerHTML = '';
        filtered.forEach((item, index) => {
            const recipe = recipesByOutput.get(item.id);
            const inputs = recipe ? recipe.inputs.map(input => `${input.amount}× ${ITEM_NAME_BY_ID[input.item] || input.item}`).join(' + ') : 'Natürliches Vorkommen';
            const card = document.createElement('article');
            card.className = 'codex-card';
            card.innerHTML = `<span class="codex-icon">${icons[index % icons.length]}</span><div><h4>${item.name}</h4><p>${inputs} → ${recipe?.machine || 'Extraktor'} · ${recipe ? `${recipe.rate_per_min}/Min` : `${item.base_output_per_min}/Min`}</p></div><span class="codex-value">🪙 ${item.gold_value}</span>`;
            list.appendChild(card);
        });
        document.getElementById('codex-count').innerText = `${filtered.length} / ${(window.GAME_ITEMS || []).length} Einträge`;
    }

    // ----------------------------------------------------
    // STATS MODAL
    // ----------------------------------------------------

    renderStats() {
        document.getElementById('stat-total-delivered').innerText = this.sim.totalDelivered;
        document.getElementById('stat-total-gold-earned').innerText = `🪙 ${this.sim.totalGoldEarned}`;
        document.getElementById('stat-active-buildings').innerText = this.sim.buildings.size - 9; // Exclude vault tiles
        document.getElementById('stat-items-on-belts').innerText = this.sim.itemsOnBelts.length;

        const list = document.getElementById('resource-breakdown-list');
        list.innerHTML = `
            <div class="res-breakdown-row"><span>Erzabbau-Rate</span><strong>${(this.sim.itemsPerMin * 0.6).toFixed(0)} / Min</strong></div>
            <div class="res-breakdown-row"><span>Fertigungs-Effizienz</span><strong>${(this.sim.itemsPerMin > 0 ? 98 : 0)}%</strong></div>
            <div class="res-breakdown-row"><span>Gold-Generierung</span><strong>🪙 ${this.sim.goldPerMin} / Min</strong></div>
        `;
    }

    // ----------------------------------------------------
    // TOASTS & FLOATING NUMBERS
    // ----------------------------------------------------

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    showFloatingGold(text, worldX, worldZ) {
        const overlay = document.getElementById('fx-overlay');
        const vector = new THREE.Vector3(worldX, 2.5, worldZ);
        vector.project(this.engine.camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

        const num = document.createElement('div');
        num.className = 'floating-number';
        num.innerText = text;
        num.style.left = `${x}px`;
        num.style.top = `${y}px`;
        overlay.appendChild(num);

        setTimeout(() => num.remove(), 1200);
    }
}

window.UIManager = UIManager;
