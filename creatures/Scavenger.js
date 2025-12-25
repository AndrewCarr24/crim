import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Scavenger {
    constructor(scene, position, game) {
        this.scene = scene;
        this.game = game; // For collision checks
        this.startPos = position.clone();
        this.model = null;
        this.mixer = null;
        this.state = 'IDLE';
        this.target = null;
        this.moveSpeed = 1.0;
        this.idleTime = 0;
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        const texLoader = new THREE.TextureLoader();
        const scavengerAlbedo = texLoader.load('assets/textures/scavenger_albedo.png');
        const scavengerNormal = texLoader.load('assets/textures/scavenger_normal.png');

        scavengerAlbedo.flipY = false;
        scavengerNormal.flipY = false;

        loader.load('assets/models/scavenger.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.copy(this.startPos);
            this.model.position.y = -1.0; // Adjusted ground level

            this.model.scale.set(0.015, 0.015, 0.015);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.map = scavengerAlbedo;
                        child.material.normalMap = scavengerNormal;
                        child.material.needsUpdate = true;
                    }
                }
            });

            this.scene.add(this.model);

            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);
                const action = this.mixer.clipAction(gltf.animations[0]);
                action.play();
            }
        }, undefined, (error) => {
            console.error('An error happened loading the scavenger:', error);
        });
    }

    update(delta) {
        if (!this.model || !this.mixer) return;
        this.mixer.update(delta);

        if (this.state === 'IDLE') {
            this.idleTime -= delta;
            if (this.idleTime <= 0) {
                this.pickNewTarget();
            }
        } else if (this.state === 'WALK') {
            if (!this.target) return;
            const dir = new THREE.Vector3().subVectors(this.target, this.model.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist < 0.5) {
                this.state = 'IDLE';
                this.idleTime = 2 + Math.random() * 5;
            } else {
                dir.normalize();
                const step = this.moveSpeed * delta;
                const nextPos = this.model.position.clone().addScaledVector(dir, step);
                nextPos.y = 1; // Check at player height for collision

                // Check collision with buildings
                if (this.game && this.game.checkCollision(nextPos)) {
                    // Blocked! Pick new target
                    this.pickNewTarget();
                } else {
                    this.model.position.addScaledVector(dir, step);
                    this.model.position.y = -1.0; // Stay grounded
                    this.model.rotation.y = Math.atan2(dir.x, dir.z);
                }
            }
        }
    }

    pickNewTarget() {
        const range = 15;
        const x = this.startPos.x + (Math.random() - 0.5) * 2 * range;
        const z = this.startPos.z + (Math.random() - 0.5) * 2 * range;
        this.target = new THREE.Vector3(x, 0, z);
        this.state = 'WALK';
    }
}
