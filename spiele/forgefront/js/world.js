/**
 * BUILDERMENT 3D - WORLD & ENVIRONMENT GENERATOR
 */

class WorldGenerator {
    constructor(scene, cellSize = 2) {
        this.scene = scene;
        this.cellSize = cellSize;
        this.deposits = new Map(); // key: "gx,gz" -> deposit object
        this.trees = [];
    }

    generateWorld() {
        this.createCentralGoldCitadel();
        this.spawnOreVeins();
        this.spawnNatureEnvironment();
    }

    createCentralGoldCitadel() {
        const vaultGroup = new THREE.Group();

        // 1. Octagonal Citadel Stone Foundation
        const baseGeo = new THREE.CylinderGeometry(4.4, 5.0, 1.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.65,
            roughness: 0.35
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.75;
        base.castShadow = true;
        base.receiveShadow = true;
        vaultGroup.add(base);

        // 2. Golden Central Silo Dome
        const siloGeo = new THREE.CylinderGeometry(2.6, 2.8, 4.2, 16);
        const siloMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            metalness: 0.92,
            roughness: 0.15,
            emissive: 0x78350f,
            emissiveIntensity: 0.3
        });
        const silo = new THREE.Mesh(siloGeo, siloMat);
        silo.position.y = 2.85;
        silo.castShadow = true;
        vaultGroup.add(silo);

        // 3. Four Citadel Corner Towers
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2 + Math.PI / 4;
            const tx = Math.cos(angle) * 3.4;
            const tz = Math.sin(angle) * 3.4;

            const towerGeo = new THREE.CylinderGeometry(0.75, 0.85, 3.6, 8);
            const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
            const tower = new THREE.Mesh(towerGeo, towerMat);
            tower.position.set(tx, 1.8, tz);
            tower.castShadow = true;
            vaultGroup.add(tower);

            const roofGeo = new THREE.ConeGeometry(0.95, 1.6, 8);
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.2 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.set(tx, 4.4, tz);
            vaultGroup.add(roof);
        }

        // 4. Floating Golden Coin Emblem
        const crownGeo = new THREE.TorusGeometry(1.8, 0.26, 8, 24);
        crownGeo.rotateX(Math.PI / 2);
        const crownMat = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            metalness: 0.95,
            roughness: 0.1,
            emissive: 0xb45309,
            emissiveIntensity: 0.4
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.y = 5.6;
        crown.name = "vaultCrown";
        vaultGroup.add(crown);

        const coinGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.25, 24);
        coinGeo.rotateX(Math.PI / 2);
        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            metalness: 0.98,
            roughness: 0.05,
            emissive: 0x854d0e,
            emissiveIntensity: 0.5
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.y = 6.8;
        coin.name = "vaultCoin";
        vaultGroup.add(coin);

        vaultGroup.position.set(0, 0, 0);
        this.scene.add(vaultGroup);
    }

    spawnOreVeins() {
        const veinClusters = [
            { type: 'Iron Ore', color: 0xef4444, glow: 0x991b1b, cx: -9, cz: -8, count: 9 },
            { type: 'Copper Ore', color: 0xf97316, glow: 0x9a3412, cx: 9, cz: -8, count: 9 },
            { type: 'Wood Log', color: 0x16a34a, glow: 0x14532d, cx: -9, cz: 8, count: 12, isForest: true },
            { type: 'Stone', color: 0x94a3b8, glow: 0x475569, cx: 9, cz: 8, count: 8 },
            { type: 'Coal', color: 0x0f172a, glow: 0x020617, cx: 0, cz: -12, count: 9 },
            { type: 'Wolframite', color: 0x8b5cf6, glow: 0x4c1d95, cx: -14, cz: 1, count: 8, isCrystal: true },
            { type: 'Uranium Ore', color: 0x10b981, glow: 0x065f46, cx: 14, cz: 1, count: 7, isCrystal: true }
        ];

        veinClusters.forEach(cluster => {
            for (let i = 0; i < cluster.count; i++) {
                const gx = cluster.cx + Math.floor((Math.random() - 0.5) * 5);
                const gz = cluster.cz + Math.floor((Math.random() - 0.5) * 5);
                const key = `${gx},${gz}`;
                
                // Keep center 3x3 vault clear
                if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
                if (this.deposits.has(key)) continue;

                const depositMesh = cluster.isForest
                    ? this.createTreeMesh()
                    : this.createOreBoulderMesh(cluster.color, cluster.glow, cluster.isCrystal);

                depositMesh.position.set(gx * this.cellSize, 0, gz * this.cellSize);
                this.scene.add(depositMesh);

                this.deposits.set(key, {
                    gx, gz,
                    resource: cluster.type,
                    mesh: depositMesh
                });
            }
        });
    }

    createOreBoulderMesh(colorHex, glowHex, isCrystal = false) {
        const group = new THREE.Group();

        // Main Rocky Core
        const coreGeo = new THREE.DodecahedronGeometry(0.95, 0);
        const coreMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.45,
            metalness: 0.5,
            emissive: glowHex,
            emissiveIntensity: 0.3
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.65;
        core.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        core.castShadow = true;
        core.receiveShadow = true;
        group.add(core);

        // Surrounding Crystal Crystals / Shards
        const shardCount = isCrystal ? 5 : 3;
        for (let i = 0; i < shardCount; i++) {
            const shardGeo = new THREE.ConeGeometry(0.22, 0.85, 5);
            const shardMat = new THREE.MeshStandardMaterial({
                color: colorHex,
                metalness: 0.9,
                roughness: 0.1,
                emissive: colorHex,
                emissiveIntensity: isCrystal ? 0.6 : 0.3
            });
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.set((Math.random() - 0.5) * 0.9, 0.8, (Math.random() - 0.5) * 0.9);
            shard.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (Math.random() - 0.5) * 0.6);
            shard.castShadow = true;
            group.add(shard);
        }

        return group;
    }

    createTreeMesh() {
        const group = new THREE.Group();

        // Tree Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.4, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x543d2b, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.7;
        trunk.castShadow = true;
        group.add(trunk);

        // 3 Foliage Cones
        const colors = [0x15803d, 0x16a34a, 0x22c55e];
        for (let c = 0; c < 3; c++) {
            const foliageGeo = new THREE.ConeGeometry(1.2 - c * 0.28, 1.3, 7);
            const foliageMat = new THREE.MeshStandardMaterial({ color: colors[c], roughness: 0.65 });
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 1.6 + c * 0.75;
            foliage.castShadow = true;
            group.add(foliage);
        }

        this.trees.push(group);
        return group;
    }

    spawnNatureEnvironment() {
        // Decorative flowering plants & mushrooms on non-resource tiles
        for (let i = 0; i < 30; i++) {
            const gx = Math.floor((Math.random() - 0.5) * 26);
            const gz = Math.floor((Math.random() - 0.5) * 26);
            const key = `${gx},${gz}`;
            if (Math.abs(gx) <= 2 && Math.abs(gz) <= 2) continue;
            if (this.deposits.has(key)) continue;

            const flowerGroup = new THREE.Group();
            const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 4);
            const stemMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.y = 0.17;
            flowerGroup.add(stem);

            const flowerColors = [0xf43f5e, 0x38bdf8, 0xfde047, 0xa855f7];
            const flowerGeo = new THREE.SphereGeometry(0.14, 6, 6);
            const flowerMat = new THREE.MeshBasicMaterial({
                color: flowerColors[Math.floor(Math.random() * flowerColors.length)]
            });
            const flower = new THREE.Mesh(flowerGeo, flowerMat);
            flower.position.y = 0.35;
            flowerGroup.add(flower);

            flowerGroup.position.set(gx * this.cellSize + (Math.random() - 0.5) * 1.2, 0, gz * this.cellSize + (Math.random() - 0.5) * 1.2);
            this.scene.add(flowerGroup);
        }
    }

    animate(elapsed) {
        // Sway trees gently in the breeze
        this.trees.forEach((t, i) => {
            t.rotation.z = Math.sin(elapsed * 1.5 + i) * 0.03;
        });

        // Rotate and bob the Gold Citadel crown and coin
        const crown = this.scene.getObjectByName("vaultCrown");
        const coin = this.scene.getObjectByName("vaultCoin");
        if (crown) crown.rotation.y = elapsed * 0.8;
        if (coin) {
            coin.rotation.z = elapsed * 1.4;
            coin.position.y = 6.8 + Math.sin(elapsed * 2.2) * 0.25;
        }
    }
}

window.WorldGenerator = WorldGenerator;
