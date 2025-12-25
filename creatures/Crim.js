import * as THREE from 'three';

export class Crim {
    constructor(scene, player, soundManager) {
        this.scene = scene;
        this.player = player;
        this.soundManager = soundManager;
        this.speed = 2.0;
        this.spinSpeed = 0;
        this.isSpinning = false;
        this.nextSpeechTime = Date.now() + 3000;
        this.speechInterval = 5000;

        this.group = new THREE.Group();
        this.createModel();
        // Start somewhere else
        this.group.position.set(50, 0, -50);
        this.scene.add(this.group);
    }

    createModel() {
        // Tattered Coat Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 1.3, 0.4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x2a1a1a }); // Dark brown/black
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.65;
        this.group.add(this.body);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const legMat = new THREE.MeshPhongMaterial({ color: 0x1a0a0a });
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.2, -0.35, 0);
        this.body.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.2, -0.35, 0);
        this.body.add(rightLeg);

        // Arms (outspread? no, just down creates creepy spin)
        const armGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);
        const leftArm = new THREE.Mesh(armGeo, bodyMat);
        leftArm.position.set(-0.5, 0.2, 0);
        leftArm.rotation.z = 0.3; // Slightly out
        this.body.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, bodyMat);
        rightArm.position.set(0.5, 0.2, 0);
        rightArm.rotation.z = -0.3;
        this.body.add(rightArm);

        // Burlap Sack Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.7, 0.6);
        const faceTexture = this.createBurlapTexture();
        const headMat = new THREE.MeshPhongMaterial({ map: faceTexture });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.set(0, 0.8, 0); // On top of body
        this.body.add(this.head);

        // Nails sticking out of head
        const nailGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
        const nailMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.4 });

        for (let i = 0; i < 8; i++) {
            const nail = new THREE.Mesh(nailGeo, nailMat);
            // Random positions on head
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            const r = 0.3; // Half of head size roughly

            nail.position.set(
                r * Math.sin(theta) * Math.cos(phi),
                r * Math.sin(theta) * Math.sin(phi) + 0.1, // Offset up slightly
                r * Math.cos(theta)
            );
            nail.lookAt(0, 0, 0); // Point inward (or outward if we reverse LookAt)
            nail.lookAt(nail.position.clone().multiplyScalar(2)); // Point outward
            this.head.add(nail);
        }
    }

    createBurlapTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Brown burlap base
        ctx.fillStyle = '#8b6945';
        ctx.fillRect(0, 0, 256, 256);

        // Woven pattern
        ctx.strokeStyle = '#6d5236';
        ctx.lineWidth = 2;
        for (let i = 0; i < 256; i += 4) {
            if (Math.random() > 0.5) {
                // Vertical thread
                ctx.beginPath();
                ctx.moveTo(i, 0); ctx.lineTo(i, 256);
                ctx.stroke();
            }
            if (Math.random() > 0.5) {
                // Horizontal thread
                ctx.beginPath();
                ctx.moveTo(0, i); ctx.lineTo(256, i);
                ctx.stroke();
            }
        }

        // Stitched Mouth
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(80, 180);
        ctx.quadraticCurveTo(128, 200, 176, 180); // Smile?
        ctx.stroke();

        // Stitches across mouth
        ctx.lineWidth = 2;
        for (let x = 90; x < 170; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, 175); ctx.lineTo(x, 195);
            ctx.stroke();
        }

        // Button Eye (One)
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(90, 100, 15, 0, Math.PI * 2);
        ctx.fill();
        // Cross stitch in eye
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(80, 90); ctx.lineTo(100, 110);
        ctx.moveTo(100, 90); ctx.lineTo(80, 110);
        ctx.stroke();

        // Empty Black Eye (Other)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(166, 100, 18, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    update(delta, game) {
        // Speech Logic
        if (Date.now() > this.nextSpeechTime) {
            this.speak();
            this.nextSpeechTime = Date.now() + this.speechInterval + Math.random() * 2000;
        }

        // Movement Logic
        const playerPos = this.player.position.clone();
        playerPos.y = 0;
        const crimPos = this.group.position.clone();
        crimPos.y = 0;
        const distance = crimPos.distanceTo(playerPos);

        // Spin Logic
        if (Math.random() < 0.01) this.isSpinning = !this.isSpinning;

        if (this.isSpinning) {
            this.spinSpeed += delta * 10;
            this.group.rotation.y += this.spinSpeed * delta;
            if (this.spinSpeed > 20) this.spinSpeed = 20;
        } else {
            this.spinSpeed *= 0.9;
            this.group.rotation.y += this.spinSpeed * delta;

            // Only move if not spinning wildly
            if (this.spinSpeed < 1.0) {
                const direction = playerPos.sub(crimPos).normalize();
                if (distance > 3) {
                    this.group.lookAt(this.player.position.x, this.group.position.y, this.player.position.z);
                    this.group.position.addScaledVector(direction, this.speed * delta);
                }
            }
        }

        // Float/Bob
        this.group.position.y = Math.sin(Date.now() * 0.003) * 0.1;

        // Attack/Interact logic (Just annoying for now?)
        if (distance < 2.0 && this.isSpinning) {
            // If he spins into you, knockback? Or just sound
        }
    }

    speak() {
        if (this.soundManager) {
            const playerPos = this.player.position.clone();
            playerPos.y = 0;
            const crimPos = this.group.position.clone();
            crimPos.y = 0;
            const distance = crimPos.distanceTo(playerPos);

            // Volume falloff
            let volume = 1.0 - (distance - 2) / 28;
            volume = Math.max(0, Math.min(1, volume));

            if (volume > 0) {
                console.log(`Crim screaming. Vol: ${volume.toFixed(2)}`);
                this.soundManager.playCrimScream(volume);
            }
        }
    }
}
