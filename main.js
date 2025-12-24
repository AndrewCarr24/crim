import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Seeded random number generator (mulberry32)
class SeededRandom {
    constructor(seed = 12345) {
        this.seed = seed;
        this.state = seed;
    }

    reset() {
        this.state = this.seed;
    }

    random() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Global seeded random for city generation
const cityRandom = new SeededRandom(42069);

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.4;

        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.tempo = 140;
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.1;
        this.currentTrack = 'CITY';
    }

    setTrack(trackName) {
        if (this.currentTrack === trackName) return;
        console.log(`Switching track to ${trackName}`);
        this.currentTrack = trackName;
        if (trackName === 'CELLAR') {
            this.tempo = 90; // Slower for Reggae
        } else if (trackName === 'SHELTER') {
            this.tempo = 50; // Very slow for Gregorian chants
        } else {
            this.tempo = 140; // Faster for Horrorcore
        }
    }

    startMusic() {
        if (this.isPlaying) return;
        console.log('Starting Soundtrack...');
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }

    stopMusic() {
        this.isPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            if (this.currentTrack === 'CITY') {
                this.scheduleNote(this.current16thNote, this.nextNoteTime);
            } else if (this.currentTrack === 'SHELTER') {
                this.scheduleGregorian(this.current16thNote, this.nextNoteTime);
            } else {
                this.scheduleReggae(this.current16thNote, this.nextNoteTime);
            }
            this.nextStep();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextStep() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        if (beatNumber === 0 || beatNumber === 4 || beatNumber === 10 || Math.random() < 0.05) {
            this.playKick(time);
        }
        if (beatNumber === 8 || (beatNumber === 15 && Math.random() < 0.3)) {
            this.playSnare(time);
        }
        if (beatNumber % 2 === 0 || Math.random() < 0.2) {
            this.playHat(time);
        }
        if (beatNumber === 2 || beatNumber === 6 || beatNumber === 11 || beatNumber === 14) {
            if (Math.random() < 0.8) this.playBass(time);
        }
        if (beatNumber === 0 && Math.random() < 0.3) {
            this.playScreech(time);
        }
    }

    scheduleGregorian(beatNumber, time) {
        // Gregorian chant - slow, sustained tones in modal harmony
        // Only trigger on certain beats for long sustained notes

        // Primary drone note (continuous bass)
        if (beatNumber === 0) {
            this.playChantDrone(time);
        }

        // Chant melody (slow moving)
        if (beatNumber === 0 || beatNumber === 8) {
            this.playChantVoice(time, this.getChantNote());
        }

        // Harmony voice (parallel motion)
        if (beatNumber === 4 || beatNumber === 12) {
            if (Math.random() < 0.7) {
                this.playChantVoice(time, this.getChantNote() * 1.25); // Perfect 4th
            }
        }
    }

    getChantNote() {
        // Dorian mode notes around D
        const notes = [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63]; // D3-D4
        return notes[Math.floor(Math.random() * notes.length)];
    }

    playChantDrone(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 73.42; // D2 - low drone

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.5);
        gain.gain.linearRampToValueAtTime(0.3, time + 2.0);
        gain.gain.linearRampToValueAtTime(0, time + 2.5);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 2.5);
    }

    playChantVoice(time, freq) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.value = freq;
        osc2.frequency.value = freq * 2; // Octave above for brightness

        filter.type = 'lowpass';
        filter.frequency.value = 1500;

        // Slow attack and release for sustained choral sound
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.25, time + 0.3);
        gain.gain.linearRampToValueAtTime(0.2, time + 1.5);
        gain.gain.linearRampToValueAtTime(0, time + 2.0);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 2.0);
        osc2.stop(time + 2.0);
    }

    scheduleReggae(beatNumber, time) {
        // One Drop Rhythm (Kick on 3)
        // 16th notes: 1=0, 2=4, 3=8, 4=12

        // Kick & Sidestick on Beat 3 (One Drop)
        if (beatNumber === 8) {
            this.playKick(time);
            this.playRimshot(time);
        }

        // HiHats (Shuffled/Straight 8ths)
        if (beatNumber % 2 === 0) {
            this.playHat(time, 0.1); // Closed
        }

        // The Skank (Chords on 2 and 4)
        if (beatNumber === 4 || beatNumber === 12) {
            this.playReggaeChop(time);
        }

        // Dub Bass (Syncopated)
        // Simple bass pattern
        if (beatNumber === 0 || beatNumber === 10 || (beatNumber === 14 && Math.random() < 0.5)) {
            this.playDubBass(time);
        }
    }

    playRimshot(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(400, time);
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    playReggaeChop(time) {
        // Quick, filtered saw chord
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const osc3 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc3.type = 'sawtooth';

        // G Minorish chord
        osc1.frequency.value = 392.00; // G4
        osc2.frequency.value = 466.16; // Bb4
        osc3.frequency.value = 587.33; // D5

        filter.type = 'highpass';
        filter.frequency.value = 800;

        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(time);
        osc2.start(time);
        osc3.start(time);
        osc1.stop(time + 0.1);
        osc2.stop(time + 0.1);
        osc3.stop(time + 0.1);
    }

    playDubBass(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(98.00, time); // G2

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.1);
        gain.gain.linearRampToValueAtTime(0.01, time + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.4);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(time);

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    playHat(time) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(time);
    }

    playBass(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const notes = [43.65, 49.00, 58.27];
        const freq = notes[Math.floor(Math.random() * notes.length)];
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.linearRampToValueAtTime(1000, time + 0.1);
        filter.frequency.linearRampToValueAtTime(200, time + 0.3);

        gain.gain.setValueAtTime(0.5, time);
        gain.gain.linearRampToValueAtTime(0.4, time + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.4);
    }

    playScreech(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
        osc.frequency.linearRampToValueAtTime(400, time + 1.0);

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.linearRampToValueAtTime(0.01, time + 1.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + 1.0);
    }

    playFootstep() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playJump() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playCollect() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playCrimScream(volume = 1.0) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2 * volume, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
}

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createExplosion(position, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const geo = new THREE.IcosahedronGeometry(0.1, 0);
            const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random()) * 5,
                (Math.random() - 0.5) * 5
            );

            this.particles.push({
                mesh: particle,
                velocity: velocity,
                life: 1.0
            });
            this.scene.add(particle);
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.addScaledVector(p.velocity, delta);
            p.velocity.y -= 9.8 * delta; // gravity
            p.life -= delta * 1.5;
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}

class MiniMap {
    constructor(canvasId, game) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.game = game;
        this.canvas.width = 150;
        this.canvas.height = 150;
    }

    update() {
        const { ctx, canvas, game } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
        ctx.fill();

        const zoom = 0.5;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Draw Buildings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        game.collidableObjects.forEach(obj => {
            if (obj.geometry && obj.geometry.type === 'BoxGeometry') {
                const rx = (obj.position.x - game.camera.position.x) * zoom;
                const rz = (obj.position.z - game.camera.position.z) * zoom;
                const sw = obj.geometry.parameters.width * zoom;
                const sd = obj.geometry.parameters.depth * zoom;

                ctx.fillRect(centerX + rx - sw / 2, centerY + rz - sd / 2, sw, sd);
            }
        });

        // Draw Shards
        ctx.fillStyle = '#00f2fe';
        game.shards.forEach(shard => {
            const rx = (shard.position.x - game.camera.position.x) * zoom;
            const rz = (shard.position.z - game.camera.position.z) * zoom;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw Sentinel
        if (game.sentinel) {
            ctx.fillStyle = '#ff0000';
            const rx = (game.sentinel.group.position.x - game.camera.position.x) * zoom;
            const rz = (game.sentinel.group.position.z - game.camera.position.z) * zoom;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 4, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing effect for sentinel
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 4 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Creeper
        if (game.creeper) {
            ctx.fillStyle = '#00ff00'; // Green for creeper
            const rx = (game.creeper.group.position.x - game.camera.position.x) * zoom;
            const rz = (game.creeper.group.position.z - game.camera.position.z) * zoom;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 4, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing effect for creeper
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 4 + Math.sin(Date.now() * 0.015) * 2, 0, Math.PI * 2); // Slightly faster pulse
            ctx.stroke();
        }

        // Draw Crim
        if (game.crim) {
            ctx.fillStyle = '#ff8800'; // Orange for Crim
            const rx = (game.crim.group.position.x - game.camera.position.x) * zoom;
            const rz = (game.crim.group.position.z - game.camera.position.z) * zoom;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Player
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw Player direction
        const dir = new THREE.Vector3();
        game.camera.getWorldDirection(dir);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + dir.x * 10, centerY + dir.z * 10);
        ctx.stroke();

        // Draw Cellar (Purple Square)
        if (game.cellarLocation) {
            ctx.fillStyle = '#a020f0'; // Purple
            const rx = (game.cellarLocation.x - game.camera.position.x) * zoom;
            const rz = (game.cellarLocation.z - game.camera.position.z) * zoom;
            ctx.fillRect(centerX + rx - 3, centerY + rz - 3, 6, 6);

            // Label ? Too small. Just a distinct color.
        }

        // Scavengers not shown on minimap (per user request)

        // Cats not shown on minimap (per user request)

        // Draw Dittos (Pink)
        if (game.dittos) {
            ctx.fillStyle = '#ff69b4';
            game.dittos.forEach(d => {
                if (d.model) {
                    const rx = (d.model.position.x - game.camera.position.x) * zoom;
                    const rz = (d.model.position.z - game.camera.position.z) * zoom;
                    ctx.beginPath();
                    ctx.arc(centerX + rx, centerY + rz, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
    }
}


class Scavenger {
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
        const scavengerAlbedo = texLoader.load('scavenger_albedo.png');
        const scavengerNormal = texLoader.load('scavenger_normal.png');

        scavengerAlbedo.flipY = false;
        scavengerNormal.flipY = false;

        loader.load('scavenger.glb', (gltf) => {
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

class CatThing {
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
        loader.load('cat_thing.glb', (gltf) => {
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

class Ditto {
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
        loader.load('ditto__pokemon.glb', (gltf) => {
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

class Sentinel {
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

class Creeper {
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

class Crim {
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
        this.scene.fog = new THREE.FogExp2(0x020205, 0.04);

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
            brick: textureLoader.load('brick_facade.png'),
            glass: textureLoader.load('glass_facade.png'),
            asphalt: textureLoader.load('asphalt.png'),
            cellarDoor: textureLoader.load('cellar_door.png')
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
        // Characters moved to loadCity to support level switching
        this.sentinel = null;
        this.creeper = null;
        this.crim = null;

        window.addEventListener('sentinel-attack', () => {
            this.score = Math.max(0, this.score - 50);
            document.querySelector('#score').textContent = this.score.toString().padStart(3, '0');

            if (this.score === 0 && this.totalShards > 0) {
                // Potential game over logic
                console.log("Dead");
            }
        });

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
        const gridGeo = new THREE.PlaneGeometry(1000, 1000, 50, 50);
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
        this.scene.fog = new THREE.FogExp2(0x000510, 0.02);

        this.createSky();

        // City Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x00f2fe, 10, 100);
        pointLight.position.set(0, 20, 0);
        this.scene.add(pointLight);

        const groundGeo = new THREE.PlaneGeometry(citySize, citySize);
        const groundMat = new THREE.MeshStandardMaterial({
            map: this.textures.asphalt,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        this.scene.add(ground);

        // Neon Floor Grid
        const floorGrid = new THREE.GridHelper(citySize, 20, 0x00f2fe, 0x111111);
        floorGrid.position.y = -0.99;
        floorGrid.material.transparent = true;
        floorGrid.material.opacity = 0.3;
        this.scene.add(floorGrid);

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
        const signTexture = new THREE.TextureLoader().load('soup_kitchen_fin.png');

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
        const ambient = new THREE.AmbientLight(0xff00ff, 0.5);
        this.scene.add(ambient);

        const point = new THREE.PointLight(0x00ffff, 1, 15);
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

        // Body (Yellow with spots procedurally?) 
        // Simple for now: Orange
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.4, 0.3);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffaa00 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.7;
        group.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = 1.6;
        group.add(head);

        // Cigarette
        const cigGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2);
        const cigMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const cig = new THREE.Mesh(cigGeo, cigMat);
        cig.rotation.x = Math.PI / 2;
        cig.position.set(0.1, 1.5, 0.3);
        group.add(cig);

        // Ember
        const emberGeo = new THREE.SphereGeometry(0.025);
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const ember = new THREE.Mesh(emberGeo, emberMat);
        ember.position.set(0.0, 0.1, 0);
        cig.add(ember);

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
        }

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this.controls.isLocked) {
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;

            this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
            this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
            this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
            this.direction.normalize();

            const speedMultiplier = this.moveState.shift ? 2.5 : 1.0;
            const targetFOV = this.moveState.shift ? 85 : 75;
            this.camera.fov += (targetFOV - this.camera.fov) * 0.1;
            this.camera.updateProjectionMatrix();

            if (this.moveState.forward || this.moveState.backward) this.velocity.z -= this.direction.z * 100.0 * delta * speedMultiplier;
            if (this.moveState.left || this.moveState.right) this.velocity.x -= this.direction.x * 100.0 * delta * speedMultiplier;

            const moveDistanceX = -this.velocity.x * delta;
            const moveDistanceZ = -this.velocity.z * delta;

            if (this.canMove(moveDistanceX, moveDistanceZ)) {
                this.controls.moveRight(moveDistanceX);
                this.controls.moveForward(moveDistanceZ);
            } else {
                this.velocity.set(0, 0, 0);
            }

            // Apply Gravity and Jump
            this.verticalVelocity -= this.gravity * delta;
            this.camera.position.y += this.verticalVelocity * delta;

            if (this.camera.position.y <= 1.0) {
                this.verticalVelocity = 0;
                this.camera.position.y = 1.0;
                this.canJump = true;
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
            // Ensure object matrix is up to date
            object.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(object);
            this.collisionBoxes.push(box);
        }
        console.log(`Computed ${this.collisionBoxes.length} static collision boxes`);
    }

    resolveCollision() {
        const playerPos = this.camera.position.clone();
        playerPos.y = 1;

        const playerBox = new THREE.Box3();
        const size = 0.3; // Reduced size
        playerBox.min.set(playerPos.x - size, 0, playerPos.z - size);
        playerBox.max.set(playerPos.x + size, 2, playerPos.z + size);

        for (const box of this.collisionBoxes) {
            if (playerBox.intersectsBox(box)) {
                // Determine simplest resolution (push out closest side)
                const center = new THREE.Vector3();
                box.getCenter(center);

                const boxSize = new THREE.Vector3();
                box.getSize(boxSize);

                const dx = playerPos.x - center.x;
                const dz = playerPos.z - center.z;

                // Normalize difference vs box extent
                const ox = Math.abs(dx) - (boxSize.x / 2 + size);
                const oz = Math.abs(dz) - (boxSize.z / 2 + size);

                // If overlapping, ox and oz will be negative. The closer to 0 (less negative), the closer to edge.
                // We want to push along the axis with the LEAST overlap (closest to edge)

                if (ox > oz) {
                    // X overlap is smaller (mathematically larger negative number), push X
                    const sign = Math.sign(dx) || 1;
                    this.camera.position.x = center.x + (boxSize.x / 2 + size + 0.01) * sign;
                } else {
                    // Z overlap is smaller, push Z
                    const sign = Math.sign(dz) || 1;
                    this.camera.position.z = center.z + (boxSize.z / 2 + size + 0.01) * sign;
                }
            }
        }
    }

    checkCollision(position) {
        // Create a box for the character
        const charBox = new THREE.Box3();
        const size = 0.3;
        charBox.min.set(position.x - size, 0, position.z - size);
        charBox.max.set(position.x + size, 2, position.z + size);

        // Lazily compute if empty (should be called explicitly though)
        if (!this.collisionBoxes || this.collisionBoxes.length === 0) {
            this.computeStaticCollisionBoxes();
        }

        for (const box of this.collisionBoxes) {
            if (charBox.intersectsBox(box)) {
                return true;
            }
        }
        return false;
    }

    canMove(distX, distZ) {
        const playerPos = this.camera.position.clone();
        playerPos.y = 1;

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

new Game();
