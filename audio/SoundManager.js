export class SoundManager {
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
