import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Ditto {
    constructor(scene, position, game) {
        this.scene = scene;
        this.game = game;
        this.startPos = position.clone();
        this.model = null;
        this.mixer = null;
        this.state = 'IDLE';
        this.target = null;
        this.moveSpeed = 1.5;
        this.idleTime = 0;
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('assets/models/ditto__pokemon.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.copy(this.startPos);
            this.model.position.y = 0.1; // Near ground
            this.model.scale.set(0.25, 0.25, 0.25); // Smaller size

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // lambert3SG is the eyes/mouth material - make it black
                    if (child.material && child.material.name === 'lambert3SG') {
                        child.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
                    } else if (child.material) {
                        // Purple glow for body (lambert2SG)  
                        child.material.emissive = new THREE.Color(0x9966cc);
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
            console.error('Error loading ditto:', error);
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
                this.idleTime = 2 + Math.random() * 4;
            } else {
                dir.normalize();
                const step = this.moveSpeed * delta;
                const nextPos = this.model.position.clone().addScaledVector(dir, step);
                nextPos.y = 1;

                if (this.game && this.game.checkCollision(nextPos)) {
                    this.pickNewTarget();
                } else {
                    this.model.position.addScaledVector(dir, step);
                    this.model.position.y = 0.1;
                    this.model.rotation.y = Math.atan2(dir.x, dir.z);
                }
            }
        }
    }

    pickNewTarget() {
        const range = 20;
        const x = this.startPos.x + (Math.random() - 0.5) * 2 * range;
        const z = this.startPos.z + (Math.random() - 0.5) * 2 * range;
        this.target = new THREE.Vector3(x, 0, z);
        this.state = 'WALK';
    }
}
