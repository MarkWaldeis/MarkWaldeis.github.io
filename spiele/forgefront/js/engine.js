/**
 * FORGEFRONT 3D - THREE.JS RENDER PIPELINE & CAMERA ENGINE
 */

class RenderEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clock = new THREE.Clock();
        this.particles = [];
        this.particlePool = { smoke: [], spark: [] };
        this.particlesEnabled = true;
        this.isIsometric = false;
        this.panVelocity = new THREE.Vector2(0, 0); // WASD keyboard pan
        this.rotVelocity = 0;                       // Q/E keyboard rotate
        this._camAnimGen = 0;                       // generation counter to cancel camera animations
        this._tmpV1 = new THREE.Vector3();
        this._tmpV2 = new THREE.Vector3();
        this._tmpV3 = new THREE.Vector3();
    }

    init() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b101b);
        this.scene.fog = new THREE.FogExp2(0x0b101b, 0.0075);

        // Perspective Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
        this.camera.position.set(38, 48, 52);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        // OrbitControls — LEFT mouse is reserved for building!
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2.15;
        this.controls.minPolarAngle = 0.15;
        this.controls.minDistance = 12;
        this.controls.maxDistance = 180;
        this.controls.screenSpacePanning = false;
        this.controls.target.set(0, 0, 0);
        // LMB: build (no camera action), RMB: rotate, MMB: pan
        this.controls.mouseButtons = {
            LEFT: -1,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        this.controls.touches = {
            ONE: -1,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        // Suppress context menu so right-drag rotates freely
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.setupLighting();
        this.setupGroundAndGrid();
        this.initParticlePools();

        window.addEventListener('resize', () => this.onResize());
    }

    setupLighting() {
        // Hemisphere fill: cool sky over warm ground bounce
        const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x2a2118, 0.55);
        this.scene.add(hemi);

        // Sky Ambient
        const ambient = new THREE.AmbientLight(0xdbeafe, 0.4);
        this.scene.add(ambient);

        // Main Sun
        const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
        sun.position.set(50, 75, 35);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.bias = -0.0004;
        const d = 62;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        this.scene.add(sun);

        // Cyan Rim Fill
        const rim = new THREE.DirectionalLight(0x38bdf8, 0.4);
        rim.position.set(-45, 30, -35);
        this.scene.add(rim);
    }

    setupGroundAndGrid() {
        // Deep space base plane (beyond buildable tiles)
        const groundGeo = new THREE.PlaneGeometry(240, 240);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x0a0e16,
            roughness: 0.95,
            metalness: 0.05
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Buildable area: instanced floor plates with subtle checker variation
        const half = 20; // grid coords -20..20
        const tileGeo = new THREE.BoxGeometry(1.92, 0.08, 1.92);
        const tileMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.82,
            metalness: 0.18
        });
        const count = (half * 2 + 1) * (half * 2 + 1);
        const tiles = new THREE.InstancedMesh(tileGeo, tileMat, count);
        tiles.receiveShadow = true;
        tiles.frustumCulled = false;

        const m = new THREE.Matrix4();
        const c = new THREE.Color();
        let i = 0;
        for (let gx = -half; gx <= half; gx++) {
            for (let gz = -half; gz <= half; gz++) {
                m.makeTranslation(gx * 2, 0.04, gz * 2);
                tiles.setMatrixAt(i, m);
                // Alternating industrial plates + slight random brightness jitter
                const checker = ((gx + gz) % 2 === 0) ? 0x1b2340 : 0x141c30;
                c.setHex(checker).offsetHSL(0, 0, (Math.sin(gx * 12.9898 + gz * 78.233) * 0.5) * 0.02);
                tiles.setColorAt(i, c);
                i++;
            }
        }
        tiles.instanceMatrix.needsUpdate = true;
        if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
        this.scene.add(tiles);

        // Faint technical grid overlay
        const grid = new THREE.GridHelper(82, 41, 0x3b4a63, 0x26334d);
        grid.position.y = 0.1;
        grid.material.transparent = true;
        grid.material.opacity = 0.35;
        this.scene.add(grid);
    }

    // ----------------------------------------------------
    // PARTICLE SYSTEM (pooled — no per-frame allocations)
    // ----------------------------------------------------

    initParticlePools() {
        const smokeGeo = new THREE.DodecahedronGeometry(0.2, 0);
        const smokeMat = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.65
        });
        for (let i = 0; i < 60; i++) {
            const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
            mesh.visible = false;
            this.scene.add(mesh);
            this.particlePool.smoke.push(mesh);
        }

        const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        for (let i = 0; i < 48; i++) {
            const mesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
            mesh.visible = false;
            this.scene.add(mesh);
            this.particlePool.spark.push(mesh);
        }
    }

    _takeParticle(kind) {
        const pool = this.particlePool[kind];
        if (!pool || pool.length === 0) return null;
        const mesh = pool.pop();
        mesh.visible = true;
        return mesh;
    }

    spawnSmokePuff(x, y, z) {
        if (!this.particlesEnabled) return;
        const mesh = this._takeParticle('smoke');
        if (!mesh) return;
        mesh.material.opacity = 0.65;
        mesh.scale.setScalar(1);
        mesh.position.set(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2);

        this.particles.push({
            kind: 'smoke',
            mesh: mesh,
            vy: 0.8 + Math.random() * 0.4,
            vx: (Math.random() - 0.5) * 0.2,
            vz: (Math.random() - 0.5) * 0.2,
            life: 0,
            maxLife: 1.4
        });
    }

    spawnSparks(x, y, z) {
        if (!this.particlesEnabled) return;
        for (let i = 0; i < 4; i++) {
            const mesh = this._takeParticle('spark');
            if (!mesh) return;
            mesh.scale.setScalar(1);
            mesh.position.set(x, y, z);

            this.particles.push({
                kind: 'spark',
                mesh: mesh,
                vy: 1.2 + Math.random() * 1.5,
                vx: (Math.random() - 0.5) * 1.5,
                vz: (Math.random() - 0.5) * 1.5,
                life: 0,
                maxLife: 0.5
            });
        }
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += delta;
            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y += p.vy * delta;
            p.mesh.position.z += p.vz * delta;

            const lifeRatio = p.life / p.maxLife;
            if (p.kind === 'smoke' && p.mesh.material.opacity !== undefined) {
                p.mesh.material.opacity = (1 - lifeRatio) * 0.65;
            }
            p.mesh.scale.multiplyScalar(1.015);

            if (p.life >= p.maxLife) {
                p.mesh.visible = false;
                this.particlePool[p.kind].push(p.mesh);
                this.particles.splice(i, 1);
            }
        }
    }

    // ----------------------------------------------------
    // CAMERA
    // ----------------------------------------------------

    toggleIsometric() {
        this.isIsometric = !this.isIsometric;
        if (this.isIsometric) {
            const targetPos = new THREE.Vector3(45, 55, 45);
            this.animateCameraTo(targetPos, new THREE.Vector3(0, 0, 0));
        } else {
            const targetPos = new THREE.Vector3(38, 48, 52);
            this.animateCameraTo(targetPos, new THREE.Vector3(0, 0, 0));
        }
    }

    resetCameraToVault() {
        const targetPos = new THREE.Vector3(26, 34, 36);
        this.animateCameraTo(targetPos, new THREE.Vector3(0, 0, 0));
    }

    animateCameraTo(targetPos, targetLookAt) {
        const gen = ++this._camAnimGen;
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        let progress = 0;

        const anim = () => {
            if (gen !== this._camAnimGen) return; // cancelled by user input
            progress += 0.04;
            const eased = 1 - Math.pow(1 - Math.min(progress, 1), 3);
            this.camera.position.lerpVectors(startPos, targetPos, eased);
            this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
            if (progress < 1.0) {
                requestAnimationFrame(anim);
            }
        };
        anim();
    }

    /** Cancel any in-flight camera animation (called on user interaction). */
    cancelCameraAnim() {
        this._camAnimGen++;
    }

    /** Pan the camera across the ground plane (WASD / arrows), relative to view azimuth. */
    updateKeyboardPan(delta) {
        if (this.panVelocity.lengthSq() === 0) return;
        this.cancelCameraAnim();
        const speed = Math.max(10, this.camera.position.y * 0.55);
        const forward = this._tmpV1;
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = this._tmpV2.crossVectors(forward, this._tmpV3.set(0, 1, 0));

        const move = this._tmpV3.set(0, 0, 0)
            .addScaledVector(forward, -this.panVelocity.y)
            .addScaledVector(right, this.panVelocity.x)
            .multiplyScalar(speed * delta);

        this.camera.position.add(move);
        this.controls.target.add(move);
    }

    /** Rotate the camera around its target (Q / E keys). */
    updateKeyboardRotate(delta) {
        if (this.rotVelocity === 0) return;
        this.cancelCameraAnim();
        const angle = this.rotVelocity * delta * 1.7;
        const offset = this._tmpV1.subVectors(this.camera.position, this.controls.target);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = offset.x * cos + offset.z * sin;
        const z = -offset.x * sin + offset.z * cos;
        offset.x = x;
        offset.z = z;
        this.camera.position.copy(this.controls.target).add(offset);
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    getGridIntersection(clientX, clientY, cellSize = 2) {
        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const point = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(plane, point)) {
            const gx = Math.round(point.x / cellSize);
            const gz = Math.round(point.z / cellSize);
            return { gx, gz, point };
        }
        return null;
    }
}

window.renderEngine = new RenderEngine();
