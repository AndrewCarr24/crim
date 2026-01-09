import * as THREE from 'three';

export class MiniMap {
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
        }

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

        // Draw Easter Egg House (Gold house icon - SW corner)
        if (game.easterEggHouseLocation) {
            ctx.fillStyle = '#ffd700'; // Gold
            const rx = (game.easterEggHouseLocation.x - game.camera.position.x) * zoom;
            const rz = (game.easterEggHouseLocation.z - game.camera.position.z) * zoom;

            // Draw a simple house shape
            ctx.beginPath();
            ctx.moveTo(centerX + rx, centerY + rz - 5); // Roof peak
            ctx.lineTo(centerX + rx + 5, centerY + rz); // Roof right
            ctx.lineTo(centerX + rx + 3, centerY + rz); // House top right
            ctx.lineTo(centerX + rx + 3, centerY + rz + 4); // House bottom right
            ctx.lineTo(centerX + rx - 3, centerY + rz + 4); // House bottom left
            ctx.lineTo(centerX + rx - 3, centerY + rz); // House top left
            ctx.lineTo(centerX + rx - 5, centerY + rz); // Roof left
            ctx.closePath();
            ctx.fill();

            // Pulsing glow effect
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX + rx, centerY + rz, 6 + Math.sin(Date.now() * 0.005) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}
