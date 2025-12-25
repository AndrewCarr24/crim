import * as THREE from 'three';

export class ParticleSystem {
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
