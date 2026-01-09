import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { cityRandom } from '../utils/SeededRandom.js';
import { SoundManager } from '../audio/SoundManager.js';
import { MiniMap } from '../ui/MiniMap.js';
import { ParticleSystem } from '../ui/ParticleSystem.js';
import { Scavenger } from '../creatures/Scavenger.js';
import { CatThing } from '../creatures/CatThing.js';
import { Ditto } from '../creatures/Ditto.js';
import { Sentinel } from '../creatures/Sentinel.js';
import { Creeper } from '../creatures/Creeper.js';
import { Crim } from '../creatures/Crim.js';
import { Physics } from './Physics.js';

class Game {
    constructor() {
        this.canvas = document.querySelector('#game-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020205);
        this.scene.fog = new THREE.FogExp2(0x020205, 0.015);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.camera.position.y = 1;

        this.clock = new THREE.Clock();

        this.controls = new PointerLockControls(this.camera, document.body);
        this.moveState = { forward: false, backward: false, left: false, right: false, shift: false };
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.collidableObjects = [];
        this.collisionBoxes = [];
        this.shards = [];
        this.totalShards = 0;
        this.score = 0;
        this.raycaster = new THREE.Raycaster();
        this.isSessionStarted = false;

        this.verticalVelocity = 0;
        this.canJump = true;
        this.jumpHeight = 12;
        this.gravity = 30;
        this.footstepTimer = 0;

        this.loadingManager = new THREE.LoadingManager();

        const textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.textures = {
            brick: textureLoader.load('assets/textures/brick_facade.png'),
            glass: textureLoader.load('assets/textures/glass_facade.png'),
            asphalt: textureLoader.load('assets/textures/asphalt.png'),
            cellarDoor: textureLoader.load('assets/textures/cellar_door.png')
        };
        this.textures.brick.wrapS = this.textures.brick.wrapT = THREE.RepeatWrapping;
        this.textures.glass.wrapS = this.textures.glass.wrapT = THREE.RepeatWrapping;
        this.textures.asphalt.wrapS = this.textures.asphalt.wrapT = THREE.RepeatWrapping;
        this.textures.asphalt.repeat.set(50, 50);
        this.loadingManager.onLoad = () => {
            console.log('Textures loaded');
        };

        this.soundManager = new SoundManager();
        this.minimap = new MiniMap('minimap', this);
        this.particles = new ParticleSystem(this.scene);

        // Rapier.js physics
        this.physics = new Physics();
        this.physicsReady = false;

        this.initAsync();
    }

    async initAsync() {
        // Initialize physics first (WASM loading)
        await this.physics.init();
        this.physicsReady = true;
        console.log('Physics ready, starting game init');
        this.init();
    }


    init() {
        const startBtn = document.querySelector('#start-button');
        const startScreen = document.querySelector('#start-screen');
        const dashboard = document.querySelector('#dashboard');

        startBtn.addEventListener('click', () => {
            this.controls.lock();
        });

        document.querySelector('#reboot-button').addEventListener('click', () => {
            location.reload();
        });

        this.controls.addEventListener('lock', () => {
            if (!this.isSessionStarted) {
                this.isSessionStarted = true;
                document.querySelector('#start-screen').classList.add('hidden');
                document.querySelector('#dashboard').classList.remove('hidden');
                this.controls.lock();
                this.soundManager.startMusic();
            } else {
                this.controls.lock();
            }
        });

        document.addEventListener('click', () => {
            if (this.isSessionStarted && !this.controls.isLocked) {
                this.controls.lock();
            }
        });

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,
            0.4,
            0.85
        );
        this.composer.addPass(bloomPass);

        this.overlay = document.getElementById('transition-overlay');
        this.currentLevel = 'CITY';
        this.isTransitioning = false;

        // Initial City Load
        this.loadCity();

        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        this.animate();
    }

    clearScene() {
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        this.collidableObjects = [];
        this.shards = [];
        this.collisionBoxes = [];
        this.sentinel = null;
        this.creeper = null;
        this.crim = null;
        this.cellarLocation = null;
        this.cellarExit = null;
        this.shelterLocation = null;
        this.shelterExit = null;
    }

    switchLevel(targetLevel, fromLevel = null) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.overlay.classList.add('active'); // Fade to black

        // Remember where we came from
        const previousLevel = fromLevel || this.currentLevel;

        setTimeout(() => {
            try {
                this.clearScene();

                if (targetLevel === 'CELLAR') {
                    console.log('Loading Cellar...');
                    this.soundManager.setTrack('CELLAR');
                    this.loadCellar();
                    // Spawn player
                    this.camera.position.set(0, 1, 5);
                    this.camera.lookAt(0, 1, 0);
                } else if (targetLevel === 'SHELTER') {
                    console.log('Loading Shelter...');
                    this.soundManager.setTrack('SHELTER');
                    this.loadShelter();
                    // Spawn player near entrance but away from exit trigger
                    this.camera.position.set(0, 1, 5);
                    this.camera.lookAt(0, 1, -5);
                } else if (targetLevel === 'CITY') {
                    console.log('Loading City...');
                    this.soundManager.setTrack('CITY');
                    this.loadCity();

                    // Spawn player just outside the door they came from
                    console.log('>>> Returning to CITY, previousLevel:', previousLevel);
                    if (previousLevel === 'CELLAR') {
                        // Outside cellar door (trigger at z≈42, spawn at z=52 = 10 units away)
                        console.log('>>> Spawning outside CELLAR at (30, 1, 52)');
                        this.camera.position.set(30, 1, 52);
                        this.camera.lookAt(30, 1, 30);
                    } else if (previousLevel === 'SHELTER') {
                        // Outside shelter door (trigger at z≈-19, spawn at z=-5 = 14 units away)
                        console.log('>>> Spawning outside SHELTER at (70, 1, -5)');
                        this.camera.position.set(70, 1, -5);
                        this.camera.lookAt(70, 1, -30);
                    } else {
                        // Default spawn
                        console.log('>>> No previousLevel, defaulting to (0, 1, 0)');
                        this.camera.position.set(0, 1, 0);
                        this.camera.lookAt(0, 1, 10);
                    }
                }

                console.log(`Switched to ${targetLevel}`);
                this.currentLevel = targetLevel;

            } catch (error) {
                console.error('Error switching level:', error);
            }

            // Fade In - delay longer to prevent immediate re-entry
            setTimeout(() => {
                this.overlay.classList.remove('active');
                this.isTransitioning = false;
            }, 500);

        }, 1000); // Wait for fade out
    }

    createSky() {
        const starGeo = new THREE.BufferGeometry();
        const starCount = 3000;
        const posArray = new Float32Array(starCount * 3);
        const colorArray = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 400 + Math.random() * 200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            posArray[i] = r * Math.sin(phi) * Math.cos(theta);
            posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            posArray[i + 2] = r * Math.cos(phi);

            colorArray[i] = 0.5 + Math.random() * 0.5;
            colorArray[i + 1] = 0.8 + Math.random() * 0.2;
            colorArray[i + 2] = 1.0;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        const starMat = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.stars = new THREE.Points(starGeo, starMat);
        this.scene.add(this.stars);

        // Digital Grid Horizon
        const gridGeo = new THREE.PlaneGeometry(2000, 2000, 50, 50);
        const gridMat = new THREE.MeshBasicMaterial({
            color: 0x00f2fe,
            wireframe: true,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });
        this.horizonGrid = new THREE.Mesh(gridGeo, gridMat);
        this.horizonGrid.rotation.x = -Math.PI / 2;
        this.horizonGrid.position.y = -1.1;
        this.scene.add(this.horizonGrid);
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.moveState.forward = true; break;
            case 'KeyA': this.moveState.left = true; break;
            case 'KeyS': this.moveState.backward = true; break;
            case 'KeyD': this.moveState.right = true; break;
            case 'Space':
                if (this.canJump) {
                    this.verticalVelocity = this.jumpHeight;
                    this.canJump = false;
                    this.soundManager.playJump();
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight': this.moveState.shift = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.moveState.forward = false; break;
            case 'KeyA': this.moveState.left = false; break;
            case 'KeyS': this.moveState.backward = false; break;
            case 'KeyD': this.moveState.right = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.moveState.shift = false; break;
        }
    }



    loadCity() {
        // Reset seeded random for consistent city layout
        cityRandom.reset();

        const citySize = 200;
        const blockSize = 20;

        this.currentLevel = 'CITY';
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000510, 0.015);

        this.createSky();

        // City Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 2.5); // Increased brightness
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x00f2fe, 10, 100);
        pointLight.position.set(0, 20, 0);
        this.scene.add(pointLight);

        const groundGeo = new THREE.BoxGeometry(citySize, 1, citySize);
        const groundMat = new THREE.MeshStandardMaterial({
            map: this.textures.asphalt,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.position.y = -0.5; // Top surface at y=0
        ground.name = 'CityGround';
        this.scene.add(ground);

        // Add ground to Rapier physics (need to update matrix first)
        ground.updateMatrixWorld(true);
        console.log('Creating ground collider, physicsReady=' + this.physicsReady);
        this.physics.createGroundCollider(2000); // Expanded ground for off-map exploration

        const mapSize = 2000;
        // Neon Floor Grid
        const floorGrid = new THREE.GridHelper(mapSize, 100, 0x00f2fe, 0x111111);
        floorGrid.position.y = -0.99;
        floorGrid.material.transparent = true;
        floorGrid.material.opacity = 0.3;
        this.scene.add(floorGrid);

        for (let i = -mapSize / 2; i <= mapSize / 2; i += blockSize * 2) {
            if (Math.abs(i) <= citySize / 2) continue; // Skip city center which has its own density
            const hLineGeo = new THREE.PlaneGeometry(mapSize, 0.4);
            const hLineMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const hLine = new THREE.Mesh(hLineGeo, hLineMat);
            hLine.rotation.x = -Math.PI / 2;
            hLine.position.set(0, -0.99, i);
            this.scene.add(hLine);

            const vLineGeo = new THREE.PlaneGeometry(0.4, mapSize);
            const vLineMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const vLine = new THREE.Mesh(vLineGeo, vLineMat);
            vLine.rotation.x = -Math.PI / 2;
            vLine.position.set(i, -0.99, 0);
            this.scene.add(vLine);
        }

        // Inner City Grid (Dense)
        for (let i = -citySize / 2; i <= citySize / 2; i += blockSize) {
            const hLineGeo = new THREE.PlaneGeometry(citySize, 0.4);
            const hLineMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
            const hLine = new THREE.Mesh(hLineGeo, hLineMat);
            hLine.rotation.x = -Math.PI / 2;
            hLine.position.set(0, -0.99, i);
            this.scene.add(hLine);

            const vLineGeo = new THREE.PlaneGeometry(0.4, citySize);
            const vLineMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
            const vLine = new THREE.Mesh(vLineGeo, vLineMat);
            vLine.rotation.x = -Math.PI / 2;
            vLine.position.set(i, -0.99, 0);
            this.scene.add(vLine);
        }

        for (let x = -citySize / 2 + blockSize / 2; x < citySize / 2; x += blockSize) {
            for (let z = -citySize / 2 + blockSize / 2; z < citySize / 2; z += blockSize) {
                if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

                const rand = cityRandom.random();
                if (rand < 0.6) {
                    this.addBuildingBlock(x, z, blockSize);
                } else if (rand < 0.8) {
                    this.addFoliageBlock(x, z, blockSize);
                } else {
                    this.addShard(x, z);
                }
            }
        }
        this.addLandmarks();
        this.addCellar();
        this.addShelter();
        this.createSpire();
        this.createCrystal();
        this.addEasterEggHouse(); // Hidden house at the map edge

        // Scavengers spawn in the Shelter, not the city

        // Spawn 10 CatThings
        this.cats = [
            new CatThing(this.scene, new THREE.Vector3(25, 0, 25), this),
            new CatThing(this.scene, new THREE.Vector3(-30, 0, 70), this),
            new CatThing(this.scene, new THREE.Vector3(60, 0, -40), this),
            new CatThing(this.scene, new THREE.Vector3(-70, 0, -60), this),
            new CatThing(this.scene, new THREE.Vector3(15, 0, -30), this),
            new CatThing(this.scene, new THREE.Vector3(-50, 0, 20), this),
            new CatThing(this.scene, new THREE.Vector3(40, 0, 40), this),
            new CatThing(this.scene, new THREE.Vector3(-20, 0, -80), this),
            new CatThing(this.scene, new THREE.Vector3(70, 0, 15), this),
            new CatThing(this.scene, new THREE.Vector3(-80, 0, -20), this),
        ];

        // Spawn 1 Ditto
        this.dittos = [
            new Ditto(this.scene, new THREE.Vector3(80, 0, 80), this),
        ];

        // Spawn City Characters
        this.sentinel = new Sentinel(this.scene, this.camera, this.soundManager);
        this.creeper = new Creeper(this.scene, this.camera, this.soundManager);
        this.crim = new Crim(this.scene, this.camera, this.soundManager);
        this.computeStaticCollisionBoxes();
    }

    addCellar() {
        // Find a spot: Fixed location to ensure it spawns
        const x = 30;
        const z = 30;
        const size = 20;

        // Ensure we load the texture
        const doorTexture = this.textures.cellarDoor;

        // Procedural Sign Texture
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512;
        signCanvas.height = 128;
        const ctx = signCanvas.getContext('2d');

        // Dark Oak Background
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(0, 0, 512, 128);

        // Wood grain
        ctx.strokeStyle = '#281a14';
        ctx.lineWidth = 2;
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * 128);
            ctx.bezierCurveTo(100, Math.random() * 128, 400, Math.random() * 128, 512, Math.random() * 128);
            ctx.stroke();
        }

        // Text
        ctx.fillStyle = '#eaddcf'; // Bone white
        ctx.font = 'bold italic 60px "Times New Roman", serif'; // Fancy-ish
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText('The Cellar', 256, 64);

        const signTexture = new THREE.CanvasTexture(signCanvas);

        // Building
        const height = 12;
        const geo = new THREE.BoxGeometry(size, height, size);
        const mat = new THREE.MeshPhongMaterial({ map: this.textures.brick }); // Base brick
        const building = new THREE.Mesh(geo, mat);
        building.position.set(x, height / 2 - 1, z);
        this.scene.add(building);
        this.collidableObjects.push(building);

        // Store for minimap and interaction (Door location)
        // Building is at (x, z), limits are +/- size/2. Door is at +z face.
        this.cellarLocation = new THREE.Vector3(x, 0, z + size / 2 + 2); // Slightly in front of door

        const doorGeo = new THREE.PlaneGeometry(5, 8);
        const doorMat = new THREE.MeshStandardMaterial({
            map: doorTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const door = new THREE.Mesh(doorGeo, doorMat);
        // Position on South face
        door.position.set(0, -height / 2 + 4 + 0.1, size / 2 + 0.1);
        building.add(door);

        // Sign (Above door)
        const signGeo = new THREE.BoxGeometry(8, 2, 0.5);
        const signMat = new THREE.MeshStandardMaterial({ map: signTexture });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, -height / 2 + 9, size / 2 + 0.25);
        building.add(sign);

        // Spotlight on sign
        const spot = new THREE.SpotLight(0xffaa00, 5, 20, 0.5, 0.5, 1);
        spot.position.set(0, -height / 2 + 12, size / 2 + 5);
        spot.target = sign;
        building.add(spot);
        building.add(spot.target);
    }

    addShelter() {
        // Soup Kitchen / Homeless Shelter entrance
        const x = 70;
        const z = -30;
        const size = 18;

        // Load the soup kitchen sign texture
        const signTexture = new THREE.TextureLoader().load('assets/textures/soup_kitchen_fin.png');

        // Building
        const height = 10;
        const geo = new THREE.BoxGeometry(size, height, size);
        const mat = new THREE.MeshPhongMaterial({ map: this.textures.brick });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(x, height / 2 - 1, z);
        this.scene.add(building);
        this.collidableObjects.push(building);

        // Store location for proximity detection
        this.shelterLocation = new THREE.Vector3(x, 0, z + size / 2 + 2);

        // Sign with soup kitchen texture (includes door image) - 775x1373 aspect ratio
        const signGeo = new THREE.PlaneGeometry(4.5, 8);
        const signMat = new THREE.MeshStandardMaterial({
            map: signTexture,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, -1.5, size / 2 + 0.15);
        building.add(sign);

        // Spotlight on sign (warm welcoming light)
        const spot = new THREE.SpotLight(0xffddaa, 3, 25, 0.5, 0.5, 1);
        spot.position.set(0, -height / 2 + 12, size / 2 + 6);
        spot.target = sign;
        building.add(spot);
        building.add(spot.target);
    }

    loadCellar() {
        this.scene.background = new THREE.Color(0x220033); // Dark Purple
        this.scene.fog = new THREE.FogExp2(0xcc00ff, 0.05); // Pink fog

        // Checkerboard Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(10, 10);
        tex.magFilter = THREE.NearestFilter;

        const floorMat = new THREE.MeshPhongMaterial({ map: tex });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Ceiling
        const ceil = floor.clone();
        ceil.position.y = 4;
        ceil.rotation.x = Math.PI / 2;
        this.scene.add(ceil);

        // Walls
        const wallGeo = new THREE.BoxGeometry(20, 4, 1);
        const wallMat = new THREE.MeshPhongMaterial({ color: 0x00ffff, shininess: 100 });

        const backWall = new THREE.Mesh(wallGeo, wallMat);
        backWall.position.set(0, 2, -10);
        this.scene.add(backWall);
        this.collidableObjects.push(backWall);

        const frontWall = new THREE.Mesh(wallGeo, wallMat);
        frontWall.position.set(0, 2, 10);
        this.scene.add(frontWall);
        this.collidableObjects.push(frontWall);

        const sideWallGeo = new THREE.BoxGeometry(1, 4, 20);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-10, 2, 0);
        this.scene.add(leftWall);
        this.collidableObjects.push(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(10, 2, 0);
        this.scene.add(rightWall);
        this.collidableObjects.push(rightWall);

        // Bar
        const barGeo = new THREE.BoxGeometry(8, 1.2, 1.5);
        const barMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(0, 0.6, -6);
        this.scene.add(bar);
        this.collidableObjects.push(bar);

        // Exit Door
        const exitGeo = new THREE.BoxGeometry(2, 4, 0.2);
        const exitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const exit = new THREE.Mesh(exitGeo, exitMat);
        exit.position.set(0, 2, 9.4);
        this.scene.add(exit);
        this.cellarExit = exit.position;
        console.log('Cellar Exit set at:', this.cellarExit);

        // Lights
        const ambient = new THREE.AmbientLight(0xff00ff, 0.8); // Brighter ambient
        this.scene.add(ambient);

        const point = new THREE.PointLight(0x00ffff, 1.5, 20); // Brighter point light
        point.position.set(0, 3, 0);
        this.scene.add(point);

        // NPCs
        this.spawnStonerLizard(2, 0, -4);
        this.spawnSmokerCheetah(-3, 0, -5);

        this.computeStaticCollisionBoxes();
    }

    loadShelter() {
        // Vaporwave / SEGA Shredcore homeless shelter
        this.scene.background = new THREE.Color(0x1a0a2e); // Deep purple-black
        this.scene.fog = new THREE.FogExp2(0x00ffff, 0.03); // Cyan fog

        // Pixelated Grid Floor (SEGA-style)
        const floorGeo = new THREE.PlaneGeometry(30, 30);
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Neon grid pattern
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 64; i += 8) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 64);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(64, i);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(15, 15);
        tex.magFilter = THREE.NearestFilter; // Pixelated!

        const floorMat = new THREE.MeshPhongMaterial({ map: tex });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Ceiling with glow
        const ceilCanvas = document.createElement('canvas');
        ceilCanvas.width = 32; ceilCanvas.height = 32;
        const cctx = ceilCanvas.getContext('2d');
        cctx.fillStyle = '#1a0a2e';
        cctx.fillRect(0, 0, 32, 32);
        cctx.fillStyle = '#00ffff';
        cctx.fillRect(14, 14, 4, 4);
        const ceilTex = new THREE.CanvasTexture(ceilCanvas);
        ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
        ceilTex.repeat.set(10, 10);
        ceilTex.magFilter = THREE.NearestFilter;

        const ceil = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({
            map: ceilTex, emissive: 0x00ffff, emissiveIntensity: 0.1
        }));
        ceil.position.y = 5;
        ceil.rotation.x = Math.PI / 2;
        this.scene.add(ceil);

        // Walls (Neon-trimmed)
        const wallGeo = new THREE.BoxGeometry(30, 5, 0.5);
        const wallMat = new THREE.MeshPhongMaterial({
            color: 0x2a1a4a,
            emissive: 0xff00ff,
            emissiveIntensity: 0.05
        });

        const backWall = new THREE.Mesh(wallGeo, wallMat);
        backWall.position.set(0, 2.5, -15);
        this.scene.add(backWall);
        this.collidableObjects.push(backWall);

        const frontWall = new THREE.Mesh(wallGeo, wallMat);
        frontWall.position.set(0, 2.5, 15);
        this.scene.add(frontWall);
        this.collidableObjects.push(frontWall);

        const sideWallGeo = new THREE.BoxGeometry(0.5, 5, 30);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-15, 2.5, 0);
        this.scene.add(leftWall);
        this.collidableObjects.push(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(15, 2.5, 0);
        this.scene.add(rightWall);
        this.collidableObjects.push(rightWall);

        // Long dining tables
        const tableGeo = new THREE.BoxGeometry(8, 0.8, 2);
        const tableMat = new THREE.MeshPhongMaterial({ color: 0x333333 });

        for (let i = -6; i <= 6; i += 6) {
            const table = new THREE.Mesh(tableGeo, tableMat);
            table.position.set(i, 0.4, -5);
            this.scene.add(table);
            this.collidableObjects.push(table);
        }

        // Serving counter at back
        const counterGeo = new THREE.BoxGeometry(12, 1.2, 2);
        const counterMat = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.3
        });
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.set(0, 0.6, -12);
        this.scene.add(counter);
        this.collidableObjects.push(counter);

        // Exit Door (glowing white)
        const exitGeo = new THREE.BoxGeometry(3, 5, 0.3);
        const exitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const exit = new THREE.Mesh(exitGeo, exitMat);
        exit.position.set(0, 2.5, 14.6);
        this.scene.add(exit);
        this.shelterExit = exit.position.clone();
        console.log('Shelter Exit set at:', this.shelterExit);

        // Lighting
        const ambient = new THREE.AmbientLight(0xff00ff, 0.3);
        this.scene.add(ambient);

        const point1 = new THREE.PointLight(0x00ffff, 1, 20);
        point1.position.set(0, 4, 0);
        this.scene.add(point1);

        const point2 = new THREE.PointLight(0xff00ff, 0.5, 15);
        point2.position.set(-8, 4, -8);
        this.scene.add(point2);

        const point3 = new THREE.PointLight(0xff00ff, 0.5, 15);
        point3.position.set(8, 4, -8);
        this.scene.add(point3);

        // Spawn Scavengers at the dining tables
        this.scavengers = [
            new Scavenger(this.scene, new THREE.Vector3(-6, 0, -5), this),
            new Scavenger(this.scene, new THREE.Vector3(0, 0, -5), this),
            new Scavenger(this.scene, new THREE.Vector3(6, 0, -5), this),
            new Scavenger(this.scene, new THREE.Vector3(-3, 0, -8), this),
            new Scavenger(this.scene, new THREE.Vector3(3, 0, -8), this),
        ];

        this.computeStaticCollisionBoxes();
    }

    spawnStonerLizard(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        group.add(body);

        // Head
        const headGeo = new THREE.ConeGeometry(0.3, 0.6, 8);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.rotation.x = -Math.PI / 2;
        head.position.y = 1.0;
        head.position.z = 0.2;
        group.add(head);

        // Eyes (Red/Stoned)
        const eyeGeo = new THREE.SphereGeometry(0.08);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.15, 1.1, 0.3);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.15, 1.1, 0.3);
        group.add(rightEye);

        this.scene.add(group);
    }

    spawnSmokerCheetah(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Materials
        const skinColor = 0xffccaa;
        const shirtColor = 0x333333;
        const pantsColor = 0x224488;

        const skinMat = new THREE.MeshPhongMaterial({ color: skinColor });
        const shirtMat = new THREE.MeshPhongMaterial({ color: shirtColor });
        const pantsMat = new THREE.MeshPhongMaterial({ color: pantsColor });

        // Generate Face Texture
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 64; faceCanvas.height = 64;
        const ctx = faceCanvas.getContext('2d');

        // Skin background
        ctx.fillStyle = '#' + new THREE.Color(skinColor).getHexString();
        ctx.fillRect(0, 0, 64, 64);

        // Eyes (White)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, 20, 15, 10); // Left Eye
        ctx.fillRect(39, 20, 15, 10); // Right Eye

        // Pupils (Black) - looking slightly to the side/stoned
        ctx.fillStyle = '#000000';
        ctx.fillRect(16, 22, 6, 6);
        ctx.fillRect(45, 22, 6, 6);

        // Mouth (smoker)
        ctx.fillStyle = '#aa5555';
        ctx.fillRect(20, 45, 24, 4);

        const faceTex = new THREE.CanvasTexture(faceCanvas);
        faceTex.magFilter = THREE.NearestFilter; // Pixelated look

        // Face Material (Only for front face)
        const faceMat = new THREE.MeshPhongMaterial({ map: faceTex });

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.25);

        const leftLeg = new THREE.Mesh(legGeo, pantsMat);
        leftLeg.position.set(-0.15, 0.45, 0);
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, pantsMat);
        rightLeg.position.set(0.15, 0.45, 0);
        group.add(rightLeg);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const torso = new THREE.Mesh(torsoGeo, shirtMat);
        torso.position.set(0, 1.25, 0);
        group.add(torso);

        // Head - Multi-material to put face only on front
        const headGeo = new THREE.BoxGeometry(0.25, 0.3, 0.25);
        // Materials order: +x, -x, +y, -y, +z, -z
        // We want face on +z
        const headMaterials = [
            skinMat, // +x
            skinMat, // -x
            skinMat, // +y
            skinMat, // -y
            faceMat, // +z (Front face)
            skinMat  // -z
        ];
        const head = new THREE.Mesh(headGeo, headMaterials);
        head.position.set(0, 1.75, 0);
        group.add(head);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);

        // Left Arm (hanging)
        const leftArm = new THREE.Mesh(armGeo, shirtMat);
        leftArm.position.set(-0.35, 1.3, 0);
        group.add(leftArm);

        // Right Arm (Raising cig)
        const rightArm = new THREE.Mesh(armGeo, shirtMat);
        rightArm.rotation.x = -Math.PI / 4; // Lifted slightly
        rightArm.rotation.z = -Math.PI / 8; // Angled in
        rightArm.position.set(0.35, 1.3, 0.1);
        group.add(rightArm);


        // Cigarette (positioned near head)
        const cigGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.08);
        const cigMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const cig = new THREE.Mesh(cigGeo, cigMat);
        cig.rotation.x = Math.PI / 2;
        // Position relative to head/mouth area
        cig.position.set(0.05, 1.68, 0.2);
        group.add(cig);

        // Ember
        const emberGeo = new THREE.SphereGeometry(0.01);
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const ember = new THREE.Mesh(emberGeo, emberMat);
        ember.position.set(0.0, 0.04, 0);
        cig.add(ember);

        // Smoke particle simulation (simple rising cubes)
        // Note: Real particle system is better, but for a static mesh group this adds flair
        // We'll skip complex particles here to keep it simple as a "model replacement"

        this.scene.add(group);
    }


    addBuildingBlock(x, z, blockSize) {
        const isModern = cityRandom.random() > 0.6;
        const height = isModern ? cityRandom.random() * 15 + 10 : cityRandom.random() * 8 + 4;

        const tex = (isModern ? this.textures.glass : this.textures.brick).clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.round(blockSize * 0.7 / 4), Math.round(height / 4));

        const geo = new THREE.BoxGeometry(blockSize * 0.7, height, blockSize * 0.7);
        const mat = new THREE.MeshPhongMaterial({
            map: tex,
            shininess: isModern ? 100 : 10,
            flatShading: false,
            emissive: isModern ? new THREE.Color(0x001122) : new THREE.Color(0x110000),
            emissiveIntensity: 0.5
        });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(x, height / 2 - 1, z);
        this.scene.add(building);
        this.collidableObjects.push(building);

        const roofHeight = isModern ? 0.5 : 1;
        const roofGeo = new THREE.BoxGeometry(blockSize * 0.72, roofHeight, blockSize * 0.72);
        const roofMat = new THREE.MeshStandardMaterial({ color: isModern ? 0x222222 : 0x442222 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(x, height - 1 + roofHeight / 2, z);
        this.scene.add(roof);
    }

    addFoliageBlock(x, z, blockSize) {
        const parkGeo = new THREE.PlaneGeometry(blockSize * 0.8, blockSize * 0.8);
        const parkMat = new THREE.MeshStandardMaterial({ color: 0x1a4d1a });
        const park = new THREE.Mesh(parkGeo, parkMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(x, -0.98, z);
        this.scene.add(park);

        for (let i = 0; i < 5; i++) {
            const tx = x + (cityRandom.random() - 0.5) * blockSize * 0.6;
            const tz = z + (cityRandom.random() - 0.5) * blockSize * 0.6;

            const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 2);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.set(tx, 0, tz);
            this.scene.add(trunk);
            this.collidableObjects.push(trunk);

            const leaveGeo = new THREE.IcosahedronGeometry(cityRandom.random() * 0.5 + 1, 1);
            const leaveMat = new THREE.MeshPhongMaterial({ color: 0x2d5a27 });
            const leaves = new THREE.Mesh(leaveGeo, leaveMat);
            leaves.position.set(tx, 1.5, tz);
            this.scene.add(leaves);
        }
    }

    addLandmarks() {
        // Duke Chapel-ish Tower
        const dukeTowerHeight = 40;
        const dukeGeo = new THREE.BoxGeometry(8, dukeTowerHeight, 8);
        const dukeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, map: this.textures.brick });
        const duke = new THREE.Mesh(dukeGeo, dukeMat);
        duke.position.set(30, dukeTowerHeight / 2 - 1, -30);
        this.scene.add(duke);
        this.collidableObjects.push(duke);

        // Bull City Sign
        const signPostGeo = new THREE.CylinderGeometry(0.2, 0.2, 10);
        const signPostMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const signPost = new THREE.Mesh(signPostGeo, signPostMat);
        signPost.position.set(-30, 4, 30);
        this.scene.add(signPost);
        this.collidableObjects.push(signPost);

        const signBoardGeo = new THREE.PlaneGeometry(8, 4);
        const signBoardMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
        const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
        signBoard.position.set(-30, 8, 30);
        this.scene.add(signBoard);

        const bullGeo = new THREE.IcosahedronGeometry(1.5, 0);
        const bullMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const bull = new THREE.Mesh(bullGeo, bullMat);
        bull.position.set(-30, 10, 30);
        this.scene.add(bull);

        // Futuristic Park Landmark
        const parkCenter = new THREE.Vector3(50, 0, 50);
        const ringGeo = new THREE.TorusGeometry(10, 0.5, 16, 100);
        const ringMat = new THREE.MeshPhongMaterial({ color: 0x00f2fe, emissive: 0x00f2fe });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(parkCenter);
        ring.position.y = 5;
        this.scene.add(ring);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const px = parkCenter.x + Math.cos(angle) * 8;
            const pz = parkCenter.z + Math.sin(angle) * 8;
            const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 12);
            const pillar = new THREE.Mesh(pillarGeo, ringMat);
            pillar.position.set(px, 5, pz);
            this.scene.add(pillar);
            this.collidableObjects.push(pillar);
        }
    }

    createSpire() {
        const spireGroup = new THREE.Group();
        const height = 60;
        const radius = 2;

        const spireGeo = new THREE.CylinderGeometry(0, radius, height, 4);
        const spireMat = new THREE.MeshPhongMaterial({
            color: 0x00f2fe,
            emissive: 0x00f2fe,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.4,
            flatShading: true
        });

        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = height / 2 - 1;
        spireGroup.add(spire);

        // Core of the spire
        const coreGeo = new THREE.CylinderGeometry(0, radius * 0.5, height, 4);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = height / 2 - 1;
        spireGroup.add(core);

        // Rotating rings around the spire
        this.spireRings = [];
        for (let i = 0; i < 5; i++) {
            const ringGeo = new THREE.TorusGeometry(radius * 3 + i * 2, 0.2, 16, 50);
            const ringMat = new THREE.MeshPhongMaterial({ color: 0x00f2fe, emissive: 0x00f2fe });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = (i + 1) * (height / 6);
            ring.rotation.x = Math.PI / 2;
            spireGroup.add(ring);
            this.spireRings.push(ring);
        }

        spireGroup.position.set(0, 0, 0); // Center of the city
        this.scene.add(spireGroup);
        this.spire = spireGroup;

        // Light from spire
        const spireLight = new THREE.PointLight(0x00f2fe, 50, 100);
        spireLight.position.set(0, height / 2, 0);
        this.scene.add(spireLight);
    }

    createCrystal() {
        const geometry = new THREE.OctahedronGeometry(1.5, 0);
        const material = new THREE.MeshPhongMaterial({
            color: 0x00f2fe,
            emissive: 0x004cff,
            flatShading: true,
            shininess: 100,
            transparent: true,
            opacity: 0.8
        });

        this.crystal = new THREE.Mesh(geometry, material);
        this.crystal.position.y = 1;
        this.scene.add(this.crystal);

        const coreGeo = new THREE.IcosahedronGeometry(0.6, 1);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.crystal.add(this.core);
    }

    addEasterEggHouse() {
        const loader = new GLTFLoader();
        const houseX = 200;
        const houseZ = 200;

        loader.load(
            './assets/maps/house.glb',
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(0.03, 0.03, 0.03);
                model.position.set(houseX, -2.0, houseZ);
                model.updateMatrixWorld(true);

                // Enable shadows
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                        }
                    }
                });

                this.scene.add(model);
                this.easterEggHouse = model;

                // Create physics colliders from the GLB meshes
                if (this.physicsReady) {
                    this.physics.addModelColliders(model);
                }

                // Bright light at the house
                const houseLight = new THREE.PointLight(0xffffff, 1000, 250);
                houseLight.position.set(houseX, 20, houseZ);
                this.scene.add(houseLight);

                console.log('House (physics colliders) loaded at:', houseX, houseZ);
            },
            undefined,
            (err) => {
                console.error('Error loading house.glb:', err);
            }
        );
    }


    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (Math.random() > 0.95) {
            const lat = Math.floor(Math.random() * 5 + 10);
            document.querySelector('#latency').textContent = `${lat}ms`;

            // Update coordinate display
            const coordsEl = document.querySelector('#coords');
            if (coordsEl) {
                coordsEl.textContent = `X: ${Math.round(this.camera.position.x)} Z: ${Math.round(this.camera.position.z)}`;
            }
        }

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        // Step physics world
        if (this.physicsReady) {
            this.physics.step(delta);
        }

        if (this.controls.isLocked) {
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;

            this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
            this.direction.x = Number(this.moveState.left) - Number(this.moveState.right);
            this.direction.normalize();

            const speedMultiplier = this.moveState.shift ? 2.5 : 1.0;
            const targetFOV = this.moveState.shift ? 85 : 75;
            this.camera.fov += (targetFOV - this.camera.fov) * 0.1;
            this.camera.updateProjectionMatrix();

            if (this.moveState.forward || this.moveState.backward) this.velocity.z -= this.direction.z * 100.0 * delta * speedMultiplier;
            if (this.moveState.left || this.moveState.right) this.velocity.x -= this.direction.x * 100.0 * delta * speedMultiplier;

            // Calculate world-space movement
            const moveDistanceX = -this.velocity.x * delta;
            const moveDistanceZ = -this.velocity.z * delta;

            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.y = 0;
            dir.normalize();
            const sideDir = new THREE.Vector3().crossVectors(this.camera.up, dir).normalize();

            const worldMovement = new THREE.Vector3();
            worldMovement.addScaledVector(dir, moveDistanceZ);
            worldMovement.addScaledVector(sideDir, moveDistanceX);

            // Apply Gravity
            this.verticalVelocity -= this.gravity * delta;
            worldMovement.y = this.verticalVelocity * delta;

            // Use Rapier physics for collision resolution
            if (this.physicsReady && this.physics.ready) {
                const newPos = this.physics.movePlayer(
                    this.camera.position,
                    worldMovement,
                    delta
                );
                this.camera.position.copy(newPos);

                // Check if grounded
                if (this.physics.isGrounded()) {
                    this.verticalVelocity = 0;
                    this.canJump = true;
                }
            } else {
                // Fallback: no physics yet, just move freely
                this.camera.position.add(worldMovement);
                if (this.camera.position.y < 1.0) {
                    this.camera.position.y = 1.0;
                    this.verticalVelocity = 0;
                    this.canJump = true;
                }
            }

            // Footsteps
            if ((this.moveState.forward || this.moveState.backward || this.moveState.left || this.moveState.right) && this.canJump) {
                this.footstepTimer += delta;
                const interval = this.moveState.shift ? 0.25 : 0.4;
                if (this.footstepTimer > interval) {
                    this.soundManager.playFootstep();
                    this.footstepTimer = 0;
                }
            }
        }

        if (this.crystal) {
            this.crystal.rotation.y = elapsed * 0.5;
            this.crystal.position.y = 1 + Math.sin(elapsed * 2) * 0.5;

            if (this.core) {
                const scale = 1 + Math.sin(elapsed * 5) * 0.2;
                this.core.scale.set(scale, scale, scale);
            }
        }

        for (let i = this.shards.length - 1; i >= 0; i--) {
            const shard = this.shards[i];
            shard.rotation.y += delta * 2;
            shard.position.y = 0.5 + Math.sin(elapsed * 3 + i) * 0.2;

            if (this.camera.position.distanceTo(shard.position) < 2) {
                this.scene.remove(shard);
                this.shards.splice(i, 1);
                this.score += 10;
                document.querySelector('#score').textContent = this.score.toString().padStart(3, '0');
                this.soundManager.playCollect();
                this.particles.createExplosion(shard.position, 0x00f2fe);

                const remaining = this.shards.length;
                if (remaining > 0) {
                    document.querySelector('#mission-text').textContent = `COLLECT ${remaining} MORE SHARDS`;
                } else {
                    document.querySelector('#mission-text').textContent = `ALL ENERGETIC SHARDS COLLECTED`;
                    document.querySelector('#mission-text').style.color = '#fff';
                    this.showVictory();
                }
            }
        }

        if (this.particles) {
            this.particles.update(delta);
        }

        if (this.isSessionStarted) {
            this.minimap.update();
            this.minimap.update();
            if (this.scavengers) this.scavengers.forEach(s => s.update(delta));
            if (this.cats) this.cats.forEach(c => c.update(delta));
            if (this.dittos) this.dittos.forEach(d => d.update(delta));
            if (this.sentinel) this.sentinel.update(delta, this);
            if (this.creeper) this.creeper.update(delta, this);
            if (this.crim) this.crim.update(delta, this);

            // Unstuck logic
            this.resolveCollision();

            // === DEBUG LOGGING (every 60 frames ~1sec) ===
            if (!this._debugFrame) this._debugFrame = 0;
            this._debugFrame++;
            const shouldLog = this._debugFrame % 60 === 0;

            if (shouldLog) {
                const pos = this.camera.position;
                console.log(`[TRANSPORT DEBUG] Level: ${this.currentLevel} | Player: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) | Transitioning: ${this.isTransitioning}`);
                if (this.cellarLocation) console.log(`  Cellar Entry: (${this.cellarLocation.x}, ${this.cellarLocation.y}, ${this.cellarLocation.z}) | Dist: ${pos.distanceTo(this.cellarLocation).toFixed(1)}`);
                if (this.shelterLocation) console.log(`  Shelter Entry: (${this.shelterLocation.x}, ${this.shelterLocation.y}, ${this.shelterLocation.z}) | Dist: ${pos.distanceTo(this.shelterLocation).toFixed(1)}`);
                if (this.cellarExit) console.log(`  Cellar Exit: (${this.cellarExit.x}, ${this.cellarExit.y}, ${this.cellarExit.z}) | Dist: ${pos.distanceTo(this.cellarExit).toFixed(1)}`);
                if (this.shelterExit) console.log(`  Shelter Exit: (${this.shelterExit.x}, ${this.shelterExit.y}, ${this.shelterExit.z}) | Dist: ${pos.distanceTo(this.shelterExit).toFixed(1)}`);
            }

            // Check Cellar Entry (only if not transitioning)
            if (!this.isTransitioning && this.currentLevel === 'CITY' && this.cellarLocation) {
                const dist = this.camera.position.distanceTo(this.cellarLocation);
                if (dist < 2.0) {
                    console.log('>>> TRIGGERING: CITY → CELLAR | Dist:', dist.toFixed(2));
                    this.switchLevel('CELLAR');
                }
            }

            // Check Shelter Entry (only if not transitioning)
            if (!this.isTransitioning && this.currentLevel === 'CITY' && this.shelterLocation) {
                const dist = this.camera.position.distanceTo(this.shelterLocation);
                if (dist < 2.0) {
                    console.log('>>> TRIGGERING: CITY → SHELTER | Dist:', dist.toFixed(2));
                    this.switchLevel('SHELTER');
                }
            }

            // Check Cellar Exit (only if not transitioning)
            if (!this.isTransitioning && this.currentLevel === 'CELLAR' && this.cellarExit) {
                const dist = this.camera.position.distanceTo(this.cellarExit);
                if (dist < 2.0) {
                    console.log('>>> TRIGGERING: CELLAR → CITY | Dist:', dist.toFixed(2));
                    this.switchLevel('CITY', 'CELLAR');  // Explicitly pass source
                }
            }

            // Check Shelter Exit (only if not transitioning)
            if (!this.isTransitioning && this.currentLevel === 'SHELTER' && this.shelterExit) {
                const dist = this.camera.position.distanceTo(this.shelterExit);
                if (dist < 2.0) {
                    console.log('>>> TRIGGERING: SHELTER → CITY | Dist:', dist.toFixed(2));
                    this.switchLevel('CITY', 'SHELTER');  // Explicitly pass source
                }
            }
        }

        if (this.spire) {
            this.spireRings.forEach((ring, i) => {
                ring.rotation.z += delta * (i % 2 === 0 ? 1 : -1);
                ring.position.y += Math.sin(elapsed + i) * 0.05;
            });
        }

        this.composer.render();
    }

    computeStaticCollisionBoxes() {
        this.collisionBoxes = [];
        for (const object of this.collidableObjects) {
            object.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(object);

            // FILTRATION LOGIC:
            // If the box is massive (e.g. > 60 units wide), it's likely a bounding volume 
            // or a giant ground plane that will block the whole area.
            const size = new THREE.Vector3();
            box.getSize(size);

            if (size.x > 60 || size.z > 60) {
                console.warn(`Skipping giant collision box for ${object.name}:`, size.x, size.z);
                continue;
            }

            this.collisionBoxes.push(box);
        }
        console.log(`Computed ${this.collisionBoxes.length} static collision boxes`);
    }

    findFloorHeight() {
        // Absolute base ground (city asphalt)
        let highestFloor = 0;

        // Use Raycasting for perfect terrain/mesh height detection
        const raycaster = new THREE.Raycaster();
        const downDir = new THREE.Vector3(0, -1, 0);

        // Ray from slightly above the current head position
        const rayOrigin = this.camera.position.clone();
        rayOrigin.y += 0.5;

        raycaster.set(rayOrigin, downDir);

        const intersects = raycaster.intersectObjects(this.collidableObjects, true);

        if (intersects.length > 0) {
            // Find the first intersection point that is BELOW our current position or slightly inside
            for (const intersect of intersects) {
                if (intersect.point.y <= this.camera.position.y - 0.5) {
                    highestFloor = Math.max(highestFloor, intersect.point.y);
                    // Remember the mesh we are standing on to allow horizontal passing
                    this.standingOnMesh = intersect.object;
                    break;
                }
            }
        } else {
            this.standingOnMesh = null;
        }

        return highestFloor;
    }

    resolveCollision() {
        const playerPos = this.camera.position.clone();
        const eyeHeight = 1.0;
        const footLevel = playerPos.y - eyeHeight;
        const stepThreshold = 0.8;
        const size = 0.3;

        const playerBox = new THREE.Box3();
        playerBox.min.set(playerPos.x - size, footLevel, playerPos.z - size);
        playerBox.max.set(playerPos.x + size, footLevel + 2.0, playerPos.z + size);

        for (let i = 0; i < this.collisionBoxes.length; i++) {
            const box = this.collisionBoxes[i];
            const mesh = this.collidableObjects[i];

            if (playerBox.intersectsBox(box)) {
                // Hybrid Logic:
                // 1. If we are standing on this mesh (according to raycast), DON'T let it block us horizontally.
                if (this.standingOnMesh && (this.standingOnMesh === mesh || this.standingOnMesh.uuid === mesh.uuid)) {
                    continue;
                }

                // 2. Step-up logic for small bumps
                if (box.max.y < footLevel + stepThreshold) {
                    continue;
                }

                // 3. Resolve horizontal collision for Walls
                const center = new THREE.Vector3();
                box.getCenter(center);
                const boxSize = new THREE.Vector3();
                box.getSize(boxSize);

                const dx = playerPos.x - center.x;
                const dz = playerPos.z - center.z;

                const ox = Math.abs(dx) - (boxSize.x / 2 + size);
                const oz = Math.abs(dz) - (boxSize.z / 2 + size);

                if (ox > oz) {
                    const sign = Math.sign(dx) || 1;
                    this.camera.position.x = center.x + (boxSize.x / 2 + size + 0.01) * sign;
                } else {
                    const sign = Math.sign(dz) || 1;
                    this.camera.position.z = center.z + (boxSize.z / 2 + size + 0.01) * sign;
                }
            }
        }
    }

    checkCollision(position) {
        const charBox = new THREE.Box3();
        const size = 0.3;
        const eyeHeight = 1.0;
        const footLevel = position.y - eyeHeight;
        const stepHeight = 0.8; // High threshold for accessibility

        charBox.min.set(position.x - size, footLevel, position.z - size);
        charBox.max.set(position.x + size, footLevel + 2.0, position.z + size);

        if (!this.collisionBoxes || this.collisionBoxes.length === 0) {
            this.computeStaticCollisionBoxes();
        }

        for (const box of this.collisionBoxes) {
            if (charBox.intersectsBox(box)) {
                // STEP HEIGHT: Allow horizontal movement into things we can step over
                if (box.max.y < footLevel + stepHeight) {
                    continue;
                }
                return true;
            }
        }
        return false;
    }

    canMove(distX, distZ) {
        const playerPos = this.camera.position.clone();

        // Calculate theoretical next position (World Space)
        const nextPos = playerPos.clone();
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();

        const sideDir = new THREE.Vector3().crossVectors(this.camera.up, dir).normalize();

        const worldStep = new THREE.Vector3();
        worldStep.addScaledVector(dir, distZ);
        worldStep.addScaledVector(sideDir, distX);

        const targetPos = playerPos.clone().add(worldStep);

        // 1. Check full move
        if (!this.checkCollision(targetPos)) {
            this.controls.moveRight(distX);
            this.controls.moveForward(distZ);
            return true;
        }

        // 2. Sliding Logic (Project onto World Axes)
        // If we can't move diagonally, try moving along X axis only (if our step has X component)
        if (Math.abs(worldStep.x) > 0.0001) {
            const posX = playerPos.clone();
            posX.x += worldStep.x;
            if (!this.checkCollision(posX)) {
                this.camera.position.x += worldStep.x;
                return true;
            }
        }

        // 3. Try moving along Z axis only
        if (Math.abs(worldStep.z) > 0.0001) {
            const posZ = playerPos.clone();
            posZ.z += worldStep.z;
            if (!this.checkCollision(posZ)) {
                this.camera.position.z += worldStep.z;
                return true;
            }
        }

        // Blocked completely
        this.velocity.set(0, 0, 0);
        return false;
    }

    addShard(x, z) {
        const geo = new THREE.OctahedronGeometry(0.3, 0);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x00f2fe,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });
        const shard = new THREE.Mesh(geo, mat);
        shard.position.set(x + (Math.random() - 0.5) * 5, 0.5, z + (Math.random() - 0.5) * 5);
        this.scene.add(shard);
        this.shards.push(shard);
        this.totalShards++;
        document.querySelector('#mission-text').textContent = `COLLECT ${this.shards.length} SHARDS`;
    }

    showVictory() {
        this.isSessionStarted = false;
        this.controls.unlock();
        setTimeout(() => {
            document.querySelector('#dashboard').classList.add('hidden');
            const victoryScreen = document.querySelector('#victory-screen');
            victoryScreen.classList.remove('hidden');
            victoryScreen.classList.remove('no-pointer');
            document.querySelector('#final-score').textContent = this.score.toString().padStart(3, '0');
        }, 1000);
    }
}

export { Game };
