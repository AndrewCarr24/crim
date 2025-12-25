import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CatThing {
    constructor(scene, position, game) {
        this.scene = scene;
        this.game = game;
        this.startPos = position.clone();
        this.model = null;
        this.mixer = null;
        this.state = 'IDLE';
        this.target = null;
        this.moveSpeed = 2.0; // Cats are faster
        this.idleTime = 0;
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('assets/models/cat_thing.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.copy(this.startPos);
            this.model.position.y = 1.5; // Float higher
            this.model.scale.set(0.5, 0.5, 0.5);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;

                    const name = child.name.toLowerCase();
                    if (name.includes('eye') || name.includes('mouth') || name.includes('sphere')) {
                        // Eyes and mouth are black
                        child.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
                    } else if (child.material) {
                        // Subtle glow for body
                        child.material.emissive = new THREE.Color(0x00ffff);
                        child.material.emissiveIntensity = 0.3;
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
            console.error('Error loading cat_thing:', error);
        });
    }

    update(delta) {
        if (!this.model) return;
        if (this.mixer) this.mixer.update(delta);

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
                this.idleTime = 1 + Math.random() * 3;
            } else {
                dir.normalize();
                const step = this.moveSpeed * delta;
                const nextPos = this.model.position.clone().addScaledVector(dir, step);
                nextPos.y = 1;

                if (this.game && this.game.checkCollision(nextPos)) {
                    this.pickNewTarget();
                } else {
                    this.model.position.addScaledVector(dir, step);
                    this.model.position.y = 1.5; // Maintain hover
                    this.model.rotation.y = Math.atan2(dir.x, dir.z);
                }
            }
        }
    }

    pickNewTarget() {
        const range = 25;
        const x = this.startPos.x + (Math.random() - 0.5) * 2 * range;
        const z = this.startPos.z + (Math.random() - 0.5) * 2 * range;
        this.target = new THREE.Vector3(x, 0, z);
        this.state = 'WALK';
    }
}
