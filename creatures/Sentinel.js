import * as THREE from 'three';

export class Sentinel {
    constructor(scene, player, soundManager) {
        this.scene = scene;
        this.player = player;
        this.soundManager = soundManager;
        this.speed = 3.5;
        this.attackRange = 2.0;
        this.lastAttackTime = 0;
        this.attackCooldown = 2000;

        this.group = new THREE.Group();
        this.createModel();
        this.scene.add(this.group);

        this.velocity = new THREE.Vector3();
    }

    createModel() {
        // Cheap Suit Body - slightly lighter grey for "cheap" look
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.4, 0.4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Cheap grey suit
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.7;
        this.group.add(this.body);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const legMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.2, -0.4, 0);
        this.body.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.2, -0.4, 0);
        this.body.add(rightLeg);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const leftArm = new THREE.Mesh(armGeo, bodyMat);
        leftArm.position.set(-0.5, 0.3, 0);
        this.body.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, bodyMat);
        rightArm.position.set(0.5, 0.3, 0);
        this.body.add(rightArm);
        this.rightArm = rightArm;

        // Head with Creepy Face - slightly larger for caricature
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
        const faceTexture = this.createFaceTexture();
        const headMaterials = [
            new THREE.MeshPhongMaterial({ color: 0xddccaa }), // right
            new THREE.MeshPhongMaterial({ color: 0xddccaa }), // left
            new THREE.MeshPhongMaterial({ color: 0xddccaa }), // top
            new THREE.MeshPhongMaterial({ color: 0xddccaa }), // bottom
            new THREE.MeshPhongMaterial({ map: faceTexture }), // front
            new THREE.MeshPhongMaterial({ color: 0xddccaa }), // back
        ];
        this.head = new THREE.Mesh(headGeo, headMaterials);
        this.head.position.set(0, 1.0, 0);
        this.group.add(this.head);

        // Fedora Hat
        const brimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 12);
        const hatMat = new THREE.MeshPhongMaterial({ color: 0xffff00 }); // Yellow Hat!
        const brim = new THREE.Mesh(brimGeo, hatMat);
        brim.position.y = 0.3;
        this.head.add(brim);

        const domeGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.25, 12);
        const dome = new THREE.Mesh(domeGeo, hatMat);
        dome.position.y = 0.15;
        brim.add(dome);

        // Black band on hat
        const bandGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12);
        const bandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = 0.05;
        dome.add(band);

        // Knife
        const knifeGeo = new THREE.BoxGeometry(0.05, 0.4, 0.1);
        const knifeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1, roughness: 0.2 });
        this.knife = new THREE.Mesh(knifeGeo, knifeMat);
        this.knife.position.set(0, -0.4, 0.2);
        this.knife.rotation.x = -Math.PI / 2;
        this.rightArm.add(this.knife);
    }

    createFaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Pale rubbery skin
        ctx.fillStyle = '#f2dcae'; // Slightly yellower
        ctx.fillRect(0, 0, 256, 256);

        // Sharp angular chin outline
        ctx.strokeStyle = '#8d754a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(60, 150);
        ctx.lineTo(128, 240); // Pointy chin
        ctx.lineTo(196, 150);
        ctx.stroke();

        // Eyes - hidden under hat brim shadow? No, lets make them stare
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(80, 100, 15, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(176, 100, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pinpoint Pupils
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(80, 100, 2, 0, Math.PI * 2);
        ctx.arc(176, 100, 2, 0, Math.PI * 2);
        ctx.fill();

        // Sharp Hook Nose
        ctx.strokeStyle = '#8d754a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(128, 100);
        ctx.lineTo(110, 160);
        ctx.lineTo(135, 160);
        ctx.stroke();

        // Thin smirk
        ctx.strokeStyle = '#4a3b21';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(90, 200);
        ctx.quadraticCurveTo(128, 210, 166, 195); // Smirk
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    update(delta, game) {
        const playerPos = this.player.position.clone();
        playerPos.y = 0;
        const sentinelPos = this.group.position.clone();
        sentinelPos.y = 0;

        const distance = sentinelPos.distanceTo(playerPos);
        const direction = playerPos.sub(sentinelPos).normalize();

        // Michael Myers style: Always walking, never running
        if (distance > 1.5) {
            const nextPos = this.group.position.clone();
            nextPos.addScaledVector(direction, this.speed * delta);

            // Check collision
            if (!game.checkCollision(nextPos)) {
                this.group.position.copy(nextPos);
            } else {
                // Try sliding
                // X axis
                const nextPosX = this.group.position.clone();
                nextPosX.x += direction.x * this.speed * delta;
                if (!game.checkCollision(nextPosX)) {
                    this.group.position.copy(nextPosX);
                } else {
                    // Z axis
                    const nextPosZ = this.group.position.clone();
                    nextPosZ.z += direction.z * this.speed * delta;
                    if (!game.checkCollision(nextPosZ)) {
                        this.group.position.copy(nextPosZ);
                    }
                }
            }

            this.group.lookAt(this.player.position.x, this.group.position.y, this.player.position.z);

            // Subtle head tilt
            this.head.rotation.z = Math.sin(Date.now() * 0.002) * 0.1;
        }

        // Bobbing movement
        this.group.position.y = Math.sin(Date.now() * 0.005) * 0.05;

        // Attack logic
        if (distance < this.attackRange && Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.attack();
        }

        // Animate attack
        if (Date.now() - this.lastAttackTime < 500) {
            this.rightArm.rotation.x = -Math.PI / 2 + Math.sin((Date.now() - this.lastAttackTime) * 0.01) * 1.5;
        } else {
            this.rightArm.rotation.x = 0;
        }
    }

    attack() {
        this.lastAttackTime = Date.now();
        this.soundManager.playJump(); // Placeholder for stab sound

        // Screenshake or feedback
        const dashboard = document.querySelector('#dashboard');
        dashboard.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        setTimeout(() => dashboard.style.backgroundColor = '', 200);

        // Reduce energy
        window.dispatchEvent(new CustomEvent('sentinel-attack'));
    }
}
