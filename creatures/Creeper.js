import * as THREE from 'three';

export class Creeper {
    constructor(scene, player, soundManager) {
        this.scene = scene;
        this.player = player;
        this.soundManager = soundManager;
        this.jumpForce = 0;
        this.isJumping = false;
        this.attackRange = 2.0;
        this.lastAttackTime = 0;
        this.attackCooldown = 1500;

        this.group = new THREE.Group();
        this.createModel();
        // Start far away
        this.group.position.set(-50, 0, -50);
        this.scene.add(this.group);

        this.velocity = new THREE.Vector3();
    }

    createModel() {
        // Stretched Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 2.0, 0.4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4a5d4a }); // Desaturated sickly green/grey
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.0;
        this.group.add(this.body);

        // Long Arms
        const armGeo = new THREE.BoxGeometry(0.15, 1.8, 0.15);
        const armMat = new THREE.MeshPhongMaterial({ color: 0x3d4b3d });
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(-0.4, 0.0, 0); // Hanging low
        leftArm.rotation.z = 0.1;
        this.body.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(0.4, 0.0, 0);
        rightArm.rotation.z = -0.1;
        this.body.add(rightArm);

        // Stretched Head
        const headGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5); // Very tall head
        const faceTexture = this.createFaceTexture();
        const headMaterials = [
            new THREE.MeshPhongMaterial({ color: 0xb0c4b0 }), // right
            new THREE.MeshPhongMaterial({ color: 0xb0c4b0 }), // left
            new THREE.MeshPhongMaterial({ color: 0xb0c4b0 }), // top
            new THREE.MeshPhongMaterial({ color: 0xb0c4b0 }), // bottom
            new THREE.MeshPhongMaterial({ map: faceTexture }), // front
            new THREE.MeshPhongMaterial({ color: 0xb0c4b0 }), // back
        ];
        this.head = new THREE.Mesh(headGeo, headMaterials);
        this.head.position.set(0, 1.6, 0);
        this.body.add(this.head);
    }

    createFaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 512; // Taller texture for taller face
        const ctx = canvas.getContext('2d');

        // Sickly pale skin
        ctx.fillStyle = '#e0e0d0';
        ctx.fillRect(0, 0, 256, 512);

        // Mottled texture
        for (let i = 0; i < 100; i++) {
            ctx.fillStyle = `rgba(100, 110, 100, ${Math.random() * 0.1})`;
            ctx.beginPath();
            ctx.arc(Math.random() * 256, Math.random() * 512, Math.random() * 20 + 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Wide, Stretched Mouth
        ctx.strokeStyle = '#2a1a1a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(128, 400, 60, 80, 0, 0, Math.PI * 2); // Vertical gaping mouth
        ctx.stroke();
        ctx.fillStyle = '#1a0a0a';
        ctx.fill();

        // Eye Sockets
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(80, 150, 25, 0, Math.PI * 2);
        ctx.arc(176, 150, 25, 0, Math.PI * 2);
        ctx.fill();

        // NAILS coming out of eyes
        ctx.strokeStyle = '#555'; // rusty metal color
        ctx.lineWidth = 6;

        // Right Eye Nail
        ctx.beginPath();
        ctx.moveTo(80, 150);
        ctx.lineTo(80, 250); // Drooping down like a tear/nail
        ctx.lineTo(60, 300); // Sharp point
        ctx.stroke();
        ctx.fillStyle = '#833'; // rust tip
        ctx.beginPath();
        ctx.arc(60, 300, 3, 0, Math.PI * 2);
        ctx.fill();

        // Left Eye Nail
        ctx.beginPath();
        ctx.moveTo(176, 150);
        ctx.lineTo(176, 260);
        ctx.lineTo(190, 310);
        ctx.stroke();
        ctx.fillStyle = '#833';
        ctx.beginPath();
        ctx.arc(190, 310, 3, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    update(delta, game) {
        const playerPos = this.player.position.clone();
        playerPos.y = 0;
        const creeperPos = this.group.position.clone();
        creeperPos.y = 0;

        const distance = creeperPos.distanceTo(playerPos);
        const direction = playerPos.sub(creeperPos).normalize();

        // Jumping Logic
        if (!this.isJumping) {
            // Wait on ground, then jump
            if (Math.random() < 0.05) { // Random chance to jump
                this.isJumping = true;
                this.jumpForce = 15;

                // Jump towards player
                // Predict where player is going a bit? No, just jump at them
                this.velocity.x = direction.x * 8; // Faster than walking
                this.velocity.z = direction.z * 8;

                // Look at player
                this.group.lookAt(this.player.position.x, this.group.position.y, this.player.position.z);
            } else {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        } else {
            // Apply gravity
            this.jumpForce -= 30 * delta;
            this.group.position.y += this.jumpForce * delta;

            // Move horizontally while in air
            this.group.position.x += this.velocity.x * delta;
            this.group.position.z += this.velocity.z * delta;

            if (this.group.position.y <= 0) {
                this.group.position.y = 0;
                this.isJumping = false;
                this.soundManager.playFootstep(); // Thud landing
            }
        }

        // Attack logic
        if (distance < this.attackRange && Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.attack();
        }
    }

    attack() {
        this.lastAttackTime = Date.now();
        this.soundManager.playJump(); // screech sound?

        const dashboard = document.querySelector('#dashboard');
        dashboard.style.backgroundColor = 'rgba(100, 255, 100, 0.2)'; // Green flash for creeper
        setTimeout(() => dashboard.style.backgroundColor = '', 200);

        // Reduce energy
        window.dispatchEvent(new CustomEvent('sentinel-attack')); // Reusing same event for now
    }
}
