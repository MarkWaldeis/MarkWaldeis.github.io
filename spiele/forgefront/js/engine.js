/**
 * BUILDERMENT 3D - THREE.JS RENDER PIPELINE & CAMERA ENGINE
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
        this.particlesEnabled = true;
        this.isIsometric = false;
    }

    init() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f18);
        this.scene.fog = new THREE.FogExp2(0x0a0f18, 0.01);

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
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2.15;
        this.controls.minDistance = 12;
        this.controls.maxDistance = 180;
        this.controls.target.set(0, 0, 0);

        this.setupLighting();
        this.setupGroundAndGrid();

        window.addEventListener('resize', () => this.onResize());
    }

    setupLighting() {
        // Sky Ambient
        const ambient = new THREE.AmbientLight(0xdbeafe, 0.75);
        this.scene.add(ambient);

        // Main Sun
        const sun = new THREE.DirectionalLight(0xfffbeb, 1.35);
        sun.position.set(50, 75, 35);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.bias = -0.0004;
        const d = 60;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        this.scene.add(sun);

        // Cyan Rim Fill
        const rim = new THREE.DirectionalLight(0x38bdf8, 0.45);
        rim.position.set(-45, 30, -35);
        this.scene.add(rim);
    }

    setupGroundAndGrid() {
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.88,
            metalness: 0.12
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(80, 40, 0x334155, 0x1e293b);
        grid.position.y = 0.02;
        this.scene.add(grid);
    }

    toggleIsometric() {
        this.isIsometric = !this.isIsometric;
        if (this.isIsometric) {
            // Smoothly move to true 45-deg diagonal isometric view
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
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        let progress = 0;

        const anim = () => {
            progress += 0.04;
            this.camera.position.lerpVectors(startPos, targetPos, progress);
            this.controls.target.lerpVectors(startTarget, targetLookAt, progress);
            if (progress < 1.0) {
                requestAnimationFrame(anim);
            }
        };
        anim();
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    spawnSmokePuff(x, y, z) {
        if (!this.particlesEnabled) return;
        const particleGeo = new THREE.DodecahedronGeometry(0.2, 0);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.65
        });
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.position.set(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2);
        this.scene.add(mesh);

        this.particles.push({
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
            const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const spark = new THREE.Mesh(geo, mat);
            spark.position.set(x, y, z);
            this.scene.add(spark);

            this.particles.push({
                mesh: spark,
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
            if (p.mesh.material.opacity !== undefined) {
                p.mesh.material.opacity = (1 - lifeRatio) * 0.65;
            }
            p.mesh.scale.multiplyScalar(1.015);

            if (p.life >= p.maxLife) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
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
