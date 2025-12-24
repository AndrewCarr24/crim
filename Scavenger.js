class Scavenger {
    constructor(scene, position) {
        this.scene = scene;
        this.startPos = position.clone();
        this.model = null;
        this.mixer = null;
        this.state = 'IDLE';
        this.target = null;
        this.moveSpeed = 1.5; // Walk speed
        this.idleTime = 0;
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        // Load Textures Manually
        const texLoader = new THREE.TextureLoader();
        const scavengerAlbedo = texLoader.load('scavenger_albedo.png');
        const scavengerNormal = texLoader.load('scavenger_normal.png');

        scavengerAlbedo.flipY = false;
        scavengerNormal.flipY = false;

        loader.load('scavenger.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.copy(this.startPos);
            // Lower slightly as requested (Feet contact)
            this.model.position.y = -0.15;

            // Adjusted scale for Unity imports
            this.model.scale.set(0.015, 0.015, 0.015);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Apply Textures to Material
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
            const dir = new THREE.Vector3().subVectors(this.target, this.model.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist < 0.5) {
                this.state = 'IDLE';
                this.idleTime = 2 + Math.random() * 4; // Wait 2-6 seconds
            } else {
                dir.normalize();
                this.model.position.addScaledVector(dir, this.moveSpeed * delta);
                // Orientation: face target
                // For GLTF character, usually +Z is forward. atan2(x, z) gives rotation around Y.
                // Unity models often face +Z. 
                // Math.atan2(dir.x, dir.z) is standard for object facing +Z
                this.model.rotation.y = Math.atan2(dir.x, dir.z);
            }
        }
    }

    pickNewTarget() {
        // Wander within 20m of start position
        const range = 20;
        const x = this.startPos.x + (Math.random() - 0.5) * 2 * range;
        const z = this.startPos.z + (Math.random() - 0.5) * 2 * range;
        this.target = new THREE.Vector3(x, this.model.position.y, z);
        this.state = 'WALK';
    }
}
