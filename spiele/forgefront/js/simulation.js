/**
 * BUILDERMENT 3D - FACTORY SIMULATION & LOGISTICS ENGINE
 */

const DIRS = [
    { dx: 1, dz: 0, name: 'OST (→)', angle: 0 },
    { dx: 0, dz: 1, name: 'SÜD (↓)', angle: Math.PI / 2 },
    { dx: -1, dz: 0, name: 'WEST (←)', angle: Math.PI },
    { dx: 0, dz: -1, name: 'NORD (↑)', angle: -Math.PI / 2 }
];

const ITEM_PALETTE = [0x38bdf8, 0xf97316, 0x10b981, 0xfacc15, 0xa855f7, 0xec4899, 0x94a3b8, 0xef4444];
const ITEM_DATA = Object.fromEntries((window.GAME_ITEMS || []).map((item, index) => {
    const raw = item.category === 'raw_resource';
    const advanced = item.gold_value >= 100;
    return [item.name, {
        id: item.id,
        gold: Math.max(1, item.gold_value || 1),
        color: ITEM_PALETTE[index % ITEM_PALETTE.length],
        geo: item.id === 'earthToken' ? 'coin' : raw ? 'dodeca' : advanced ? 'torus' : index % 4 === 0 ? 'ingot' : 'box',
        metal: raw ? 0.35 : 0.78,
        rough: raw ? 0.65 : 0.24
    }];
}));

const ITEM_NAME_BY_ID = Object.fromEntries((window.GAME_ITEMS || []).map(item => [item.id, item.name]));
const MACHINE_RECIPES = {};
(window.GAME_RECIPES || []).forEach(recipe => {
    const normalized = {
        id: recipe.id,
        outputId: recipe.output_id,
        output: recipe.output_item,
        amount: recipe.output_amount || 1,
        time: recipe.craft_time_sec,
        inputs: recipe.inputs.map(input => ({ item: ITEM_NAME_BY_ID[input.item] || input.item, amount: input.amount }))
    };
    if (!MACHINE_RECIPES[recipe.machine]) MACHINE_RECIPES[recipe.machine] = [];
    MACHINE_RECIPES[recipe.machine].push(normalized);
});
window.ITEM_DATA = ITEM_DATA;
window.MACHINE_RECIPES = MACHINE_RECIPES;

class FactorySimulation {
    constructor(scene, cellSize = 2) {
        this.scene = scene;
        this.cellSize = cellSize;

        // Economy & Stats
        this.gold = 250;
        this.totalDelivered = 0;
        this.totalGoldEarned = 0;
        this.goldRecentHistory = [];
        this.itemsRecentHistory = [];
        this.goldPerMin = 0;
        this.itemsPerMin = 0;

        // Game World Entities
        this.buildings = new Map(); // key: "gx,gz" -> building object
        this.itemsOnBelts = [];     // Array of items moving on belts
        this.selectedBuilding = null;

        // Technology / Upgrades
        this.conveyorTier = 1; // 1: 420/min, 2: 720/min, 3: 1080/min
        this.extractorTier = 1;
        this.producedCounts = {};
        this.deliveredCounts = {};
        this.victoryAchieved = false;

        this.initVaultTiles();
    }

    initVaultTiles() {
        // Register central 3x3 vault
        for (let gx = -1; gx <= 1; gx++) {
            for (let gz = -1; gz <= 1; gz++) {
                this.buildings.set(`${gx},${gz}`, {
                    type: 'gold_vault',
                    gx, gz,
                    isVault: true,
                    level: 1
                });
            }
        }
    }

    // ----------------------------------------------------
    // BUILDING CREATION
    // ----------------------------------------------------

    addBuilding(type, gx, gz, dir = 0, initialRecipe = null) {
        const key = `${gx},${gz}`;
        if (this.buildings.has(key)) return null;

        let mesh = null;
        let buildingData = {
            type,
            gx, gz, dir,
            level: 1,
            speedMultiplier: 1.0,
            timer: 0,
            progress: 0,
            inventory: {},
            activeRecipe: null
        };

        if (type === 'belt') {
            mesh = this.createBeltMesh(gx, gz, dir);
        } else if (type === 'underground' || type === 'splitter') {
            mesh = type === 'underground' ? this.createUndergroundMesh(gx, gz, dir) : this.createSplitterMesh(gx, gz, dir);
            buildingData.routeIndex = 0;
        } else if (type === 'extractor' || type === 'gem_tree') {
            mesh = type === 'extractor' ? this.createExtractorMesh(gx, gz, dir) : this.createGemTreeMesh(gx, gz, dir);
            buildingData.interval = type === 'extractor' ? 3.0 : 8.0;
        } else if (['furnace', 'workshop', 'forge', 'machine_shop', 'industrial_factory', 'manufacturer', 'earth_teleporter'].includes(type)) {
            mesh = this.createMachineMesh(type, gx, gz, dir);
            const recipes = MACHINE_RECIPES[type] || [];
            buildingData.recipes = recipes;
            buildingData.activeRecipe = initialRecipe || recipes[0] || null;
        }

        buildingData.mesh = mesh;
        this.buildings.set(key, buildingData);
        return buildingData;
    }

    removeBuilding(gx, gz) {
        const key = `${gx},${gz}`;
        const b = this.buildings.get(key);
        if (!b || b.isVault) return null;

        if (b.mesh) this.scene.remove(b.mesh);
        this.buildings.delete(key);

        if (this.selectedBuilding === b) {
            this.selectedBuilding = null;
        }
        return b;
    }

    // ----------------------------------------------------
    // 3D MESH BUILDERS
    // ----------------------------------------------------

    createBeltMesh(gx, gz, dir) {
        const group = new THREE.Group();

        // Metallic Rails
        const railGeo = new THREE.BoxGeometry(this.cellSize * 0.94, 0.16, this.cellSize * 0.94);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.y = 0.08;
        rail.receiveShadow = true;
        group.add(rail);

        // Tread Surface
        const treadGeo = new THREE.BoxGeometry(this.cellSize * 0.74, 0.06, this.cellSize * 0.88);
        const treadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
        const tread = new THREE.Mesh(treadGeo, treadMat);
        tread.position.y = 0.17;
        group.add(tread);

        // Glowing Chevron Direction Indicator
        const chevronGeo = new THREE.ConeGeometry(0.32, 0.65, 3);
        chevronGeo.rotateX(Math.PI / 2);
        const chevronMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const chevron = new THREE.Mesh(chevronGeo, chevronMat);
        chevron.position.set(0, 0.22, 0);
        group.add(chevron);

        group.position.set(gx * this.cellSize, 0, gz * this.cellSize);
        group.rotation.y = DIRS[dir].angle;
        this.scene.add(group);
        return group;
    }

    createUndergroundMesh(gx, gz, dir) {
        const group = new THREE.Group();

        // Tunnel Portal Arch
        const archGeo = new THREE.BoxGeometry(1.6, 1.2, 0.9);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.y = 0.6;
        arch.castShadow = true;
        group.add(arch);

        // Tunnel Dark Void
        const voidGeo = new THREE.BoxGeometry(1.1, 0.8, 0.92);
        const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const voidMesh = new THREE.Mesh(voidGeo, voidMat);
        voidMesh.position.y = 0.5;
        group.add(voidMesh);

        group.position.set(gx * this.cellSize, 0, gz * this.cellSize);
        group.rotation.y = DIRS[dir].angle;
        this.scene.add(group);
        return group;
    }

    createSplitterMesh(gx, gz, dir) {
        const group = this.createBeltMesh(gx, gz, dir);
        const hub = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.38, 0),
            new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.5, metalness: 0.8 })
        );
        hub.position.y = 0.62;
        hub.name = 'splitterHub';
        group.add(hub);
        return group;
    }

    createGemTreeMesh(gx, gz, dir) {
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, 1.5, 7), new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.6 }));
            trunk.position.y = 0.75;
            group.add(trunk);
            for (let i = 0; i < 7; i++) {
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x67e8f9 : 0xc084fc, emissive: 0x4c1d95, emissiveIntensity: 0.7, metalness: 0.75, roughness: 0.12 }));
                crystal.position.set(Math.cos(i * 2.4) * 0.75, 1.35 + (i % 3) * 0.42, Math.sin(i * 2.4) * 0.75);
                crystal.name = i === 0 ? 'drillBit' : '';
                group.add(crystal);
            }
            group.position.set(gx * this.cellSize, 0, gz * this.cellSize);
            group.rotation.y = DIRS[dir].angle;
            this.scene.add(group);
            return group;
        }

        createExtractorMesh(gx, gz, dir) {
        const group = new THREE.Group();

        // Base Scaffolding
        const baseGeo = new THREE.BoxGeometry(1.65, 0.5, 1.65);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.25;
        base.castShadow = true;
        group.add(base);

        // Mast
        const mastGeo = new THREE.CylinderGeometry(0.5, 0.65, 1.8, 8);
        const mastMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.y = 1.35;
        mast.castShadow = true;
        group.add(mast);

        // Rotating Drill Bit
        const drillGeo = new THREE.ConeGeometry(0.38, 1.1, 6);
        const drillMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
        const drill = new THREE.Mesh(drillGeo, drillMat);
        drill.position.y = 0.35;
        drill.rotation.x = Math.PI;
        drill.name = "drillBit";
        group.add(drill);

        // Green Beacon
        const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, 2.35, 0);
        group.add(beacon);

        group.position.set(gx * this.cellSize, 0, gz * this.cellSize);
        group.rotation.y = DIRS[dir].angle;
        this.scene.add(group);
        return group;
    }

    createMachineMesh(type, gx, gz, dir) {
        const group = new THREE.Group();

        const colors = {
            furnace: 0x7c2d12,
            workshop: 0x0369a1,
            forge: 0x334155,
            machine_shop: 0x581c87,
            industrial_factory: 0x065f46,
            manufacturer: 0x831843,
            earth_teleporter: 0x1d4ed8
        };

        const bodyGeo = new THREE.BoxGeometry(1.65, 1.4, 1.65);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: colors[type] || 0x334155,
            roughness: 0.45,
            metalness: 0.4
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.7;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        if (type === 'furnace') {
            // Chimney & Glowing Hearth
            const chimneyGeo = new THREE.CylinderGeometry(0.3, 0.38, 1.6, 8);
            const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
            const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
            chimney.position.set(0.35, 1.9, 0.35);
            chimney.castShadow = true;
            chimney.name = "chimney";
            group.add(chimney);

            const hearthGeo = new THREE.PlaneGeometry(0.7, 0.65);
            const hearthMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            const hearth = new THREE.Mesh(hearthGeo, hearthMat);
            hearth.position.set(0.83, 0.65, 0);
            hearth.rotation.y = Math.PI / 2;
            group.add(hearth);
        } else if (type === 'workshop') {
            // Animated Cogs
            const cogGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 8);
            const cogMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
            const cogA = new THREE.Mesh(cogGeo, cogMat);
            cogA.position.set(-0.25, 1.45, 0);
            cogA.name = "cogA";
            group.add(cogA);

            const cogB = new THREE.Mesh(cogGeo, cogMat);
            cogB.position.set(0.35, 1.45, 0);
            cogB.scale.set(0.7, 0.7, 0.7);
            cogB.name = "cogB";
            group.add(cogB);
        } else if (type === 'machine_shop' || type === 'manufacturer' || type === 'earth_teleporter') {
            // Energy Glowing Dome
            const domeGeo = new THREE.SphereGeometry(0.65, 12, 12);
            const domeMat = new THREE.MeshStandardMaterial({
                color: type === 'manufacturer' ? 0xec4899 : type === 'earth_teleporter' ? 0x60a5fa : 0x06b6d4,
                emissive: type === 'manufacturer' ? 0xdb2777 : type === 'earth_teleporter' ? 0x1d4ed8 : 0x0891b2,
                emissiveIntensity: 0.5,
                roughness: 0.1
            });
            const dome = new THREE.Mesh(domeGeo, domeMat);
            dome.position.y = 1.75;
            dome.name = "energyDome";
            group.add(dome);
        }

        group.position.set(gx * this.cellSize, 0, gz * this.cellSize);
        group.rotation.y = DIRS[dir].angle;
        this.scene.add(group);
        return group;
    }

    // ----------------------------------------------------
    // SPAWN ITEM ON BELT
    // ----------------------------------------------------

    spawnItem(itemName, startX, startZ, targetGx, targetGz) {
        const itemInfo = ITEM_DATA[itemName] || { color: 0xf8fafc, geo: 'box_flat', metal: 0.3, rough: 0.4 };
        let geo;

        if (itemInfo.geo === 'cylinder') {
            geo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8);
            geo.rotateX(Math.PI / 2);
        } else if (itemInfo.geo === 'gear') {
            geo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 6);
        } else if (itemInfo.geo === 'ingot') {
            geo = new THREE.BoxGeometry(0.5, 0.18, 0.28);
        } else if (itemInfo.geo === 'torus') {
            geo = new THREE.TorusGeometry(0.22, 0.08, 6, 12);
        } else if (itemInfo.geo === 'dodeca') {
            geo = new THREE.DodecahedronGeometry(0.26, 0);
        } else if (itemInfo.geo === 'coin') {
            geo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
            geo.rotateX(Math.PI / 2);
        } else {
            geo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
        }

        const mat = new THREE.MeshStandardMaterial({
            color: itemInfo.color,
            roughness: itemInfo.rough,
            metalness: itemInfo.metal
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(startX, 0.38, startZ);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const speed = 1.6 * this.conveyorTier;

        this.itemsOnBelts.push({
            name: itemName,
            mesh: mesh,
            currentGx: Math.round(startX / this.cellSize),
            currentGz: Math.round(startZ / this.cellSize),
            targetGx: targetGx,
            targetGz: targetGz,
            progress: 0,
            speed: speed
        });
    }

    // ----------------------------------------------------
    // MAIN SIMULATION LOOP (RUNS AT 60 FPS)
    // ----------------------------------------------------

    update(delta, depositsMap, renderEngine) {
        const now = Date.now();

        // 1. UPDATE EXTRACTORS & MACHINES
        this.buildings.forEach(b => {
            if (b.type === 'extractor' || b.type === 'gem_tree') {
                const drill = b.mesh ? b.mesh.getObjectByName("drillBit") : null;
                if (drill) drill.rotation.y += delta * 12;

                b.timer += delta * b.speedMultiplier;
                const interval = b.interval || 3.0;
                b.progress = Math.min(b.timer / interval, 1.0);

                if (b.timer >= interval) {
                    b.timer = 0;
                    b.progress = 0;
                    const deposit = depositsMap.get(`${b.gx},${b.gz}`);
                    const resName = b.type === 'gem_tree' ? 'Gem Apple' : (deposit ? deposit.resource : 'Iron Ore');
                    
                    const dir = DIRS[b.dir];
                    const targetGx = b.gx + dir.dx;
                    const targetGz = b.gz + dir.dz;
                    const targetKey = `${targetGx},${targetGz}`;

                    if (this.buildings.has(targetKey)) {
                        this.spawnItem(resName, b.gx * this.cellSize, b.gz * this.cellSize, targetGx, targetGz);
                        if (renderEngine) renderEngine.spawnSparks(b.gx * this.cellSize, 0.4, b.gz * this.cellSize);
                    }
                }
            } else if (['furnace', 'workshop', 'forge', 'machine_shop', 'industrial_factory', 'manufacturer', 'earth_teleporter'].includes(b.type)) {
                // Animate machine parts
                if (b.mesh) {
                    const cogA = b.mesh.getObjectByName("cogA");
                    const cogB = b.mesh.getObjectByName("cogB");
                    if (cogA) cogA.rotation.y += delta * 4;
                    if (cogB) cogB.rotation.y -= delta * 4;

                    const dome = b.mesh.getObjectByName("energyDome");
                    if (dome) {
                        dome.scale.setScalar(1.0 + Math.sin(now * 0.005) * 0.05);
                    }
                }

                if (b.activeRecipe) {
                    // Check if inputs are available
                    const canCraft = b.activeRecipe.inputs.every(inp => (b.inventory[inp.item] || 0) >= inp.amount);

                    if (canCraft) {
                        b.timer += delta * b.speedMultiplier;
                        const craftTime = b.activeRecipe.time;
                        b.progress = Math.min(b.timer / craftTime, 1.0);

                        // Smoke puff from furnace
                        if (b.type === 'furnace' && Math.random() < 0.1 && renderEngine) {
                            renderEngine.spawnSmokePuff(b.gx * this.cellSize + 0.35, 2.7, b.gz * this.cellSize + 0.35);
                        }

                        if (b.timer >= craftTime) {
                            b.timer = 0;
                            b.progress = 0;
                            // Consume inputs
                            b.activeRecipe.inputs.forEach(inp => {
                                b.inventory[inp.item] -= inp.amount;
                            });

                            // Spawn output
                            const dir = DIRS[b.dir];
                            const targetGx = b.gx + dir.dx;
                            const targetGz = b.gz + dir.dz;
                            this.spawnItem(b.activeRecipe.output, b.gx * this.cellSize, b.gz * this.cellSize, targetGx, targetGz);
                                                        this.producedCounts[b.activeRecipe.output] = (this.producedCounts[b.activeRecipe.output] || 0) + (b.activeRecipe.amount || 1);
                        }
                    } else {
                        b.progress = 0;
                    }
                }
            }
        });

        // 2. MOVE ITEMS ALONG BELTS
        for (let i = this.itemsOnBelts.length - 1; i >= 0; i--) {
            const item = this.itemsOnBelts[i];
            item.progress += item.speed * delta;

            const startX = item.currentGx * this.cellSize;
            const startZ = item.currentGz * this.cellSize;
            const endX = item.targetGx * this.cellSize;
            const endZ = item.targetGz * this.cellSize;

            item.mesh.position.x = THREE.MathUtils.lerp(startX, endX, Math.min(item.progress, 1.0));
            item.mesh.position.z = THREE.MathUtils.lerp(startZ, endZ, Math.min(item.progress, 1.0));
            item.mesh.rotation.y += delta * 3.0;

            if (item.progress >= 1.0) {
                const targetKey = `${item.targetGx},${item.targetGz}`;
                const targetBuilding = this.buildings.get(targetKey);

                if (!targetBuilding) {
                    this.scene.remove(item.mesh);
                    this.itemsOnBelts.splice(i, 1);
                    continue;
                }

                // A. Reached Central Gold Vault
                if (targetBuilding.isVault) {
                    this.scene.remove(item.mesh);
                    this.itemsOnBelts.splice(i, 1);

                    const value = ITEM_DATA[item.name] ? ITEM_DATA[item.name].gold : 1;
                    this.gold += value;
                    this.totalDelivered++;
                    this.totalGoldEarned += value;
                    this.deliveredCounts[item.name] = (this.deliveredCounts[item.name] || 0) + 1;
                    if ((ITEM_DATA[item.name] || {}).id === 'earthToken') this.victoryAchieved = true;

                    this.goldRecentHistory.push({ time: now, amount: value });
                    this.itemsRecentHistory.push({ time: now, count: 1 });

                    if (window.soundEngine) window.soundEngine.playGoldChime();
                    if (window.uiManager) window.uiManager.showFloatingGold(`+${value} Gold`, item.targetGx * this.cellSize, item.targetGz * this.cellSize);
                    continue;
                }

                // B. Reached Crafting Machine
                if (['furnace', 'workshop', 'forge', 'machine_shop', 'industrial_factory', 'manufacturer', 'earth_teleporter'].includes(targetBuilding.type)) {
                    targetBuilding.inventory[item.name] = (targetBuilding.inventory[item.name] || 0) + 1;
                    this.scene.remove(item.mesh);
                    this.itemsOnBelts.splice(i, 1);
                    continue;
                }

                // C. Reached Next Belt or Underground
                if (targetBuilding.type === 'belt') {
                    item.currentGx = item.targetGx;
                    item.currentGz = item.targetGz;
                    const nextDir = DIRS[targetBuilding.dir];
                    item.targetGx = item.currentGx + nextDir.dx;
                    item.targetGz = item.currentGz + nextDir.dz;
                    item.progress = 0;
                } else if (targetBuilding.type === 'splitter') {
                                    item.currentGx = item.targetGx;
                                    item.currentGz = item.targetGz;
                                    const choices = [targetBuilding.dir, (targetBuilding.dir + (targetBuilding.routeIndex++ % 2 ? 1 : 3)) % 4];
                                    const nextDir = DIRS[choices[targetBuilding.routeIndex % choices.length]];
                                    item.targetGx = item.currentGx + nextDir.dx;
                                    item.targetGz = item.currentGz + nextDir.dz;
                                    item.progress = 0;
                                } else if (targetBuilding.type === 'underground') {
                    // Jump forward 3 tiles
                    const nextDir = DIRS[targetBuilding.dir];
                    item.currentGx = item.targetGx;
                    item.currentGz = item.targetGz;
                    item.targetGx = item.currentGx + nextDir.dx * 3;
                    item.targetGz = item.currentGz + nextDir.dz * 3;
                    item.progress = 0;
                } else {
                    this.scene.remove(item.mesh);
                    this.itemsOnBelts.splice(i, 1);
                }
            }
        }

        // 3. UPDATE RATES & METRICS (1-minute sliding window)
        const cutoff = now - 60000;
        this.goldRecentHistory = this.goldRecentHistory.filter(e => e.time > cutoff);
        this.itemsRecentHistory = this.itemsRecentHistory.filter(e => e.time > cutoff);

        this.goldPerMin = this.goldRecentHistory.reduce((sum, e) => sum + e.amount, 0);
        this.itemsPerMin = this.itemsRecentHistory.reduce((sum, e) => sum + e.count, 0);
    }
}

window.FactorySimulation = FactorySimulation;
