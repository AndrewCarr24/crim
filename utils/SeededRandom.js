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
export const cityRandom = new SeededRandom(42069);
export { SeededRandom };
