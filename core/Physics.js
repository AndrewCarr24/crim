import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';

/**
 * Physics module using Rapier.js for proper GLB mesh collision.
 * Handles trimesh colliders for terrain/buildings and character controller for player.
 */
export class Physics {
    constructor() {
        this.world = null;
        this.colliders = [];
        this.playerController = null;
        this.playerCollider = null;
        this.playerBody = null;
        this.ready = false;
        // Map to store colliders by mesh ID or name if needed, but array is fine for now
    }

    /**
     * Initialize the Rapier physics engine (async - WASM loading)
     */
    async init() {
        await RAPIER.init();

        // Create physics world with gravity
        const gravity = { x: 0.0, y: -30.0, z: 0.0 };
        this.world = new RAPIER.World(gravity);

        // Create character controller for player movement
        this.playerController = this.world.createCharacterController(0.01); // 0.01 = offset distance
        this.playerController.enableAutostep(0.5, 0.2, true); // maxHeight, minWidth, includeDynamicBodies
        this.playerController.enableSnapToGround(0.5); // distance to snap
        this.playerController.setApplyImpulsesToDynamicBodies(true);

        // Create player capsule collider (radius 0.3, half-height 0.7 -> total height ~2m)
        const playerDesc = RAPIER.ColliderDesc.capsule(0.7, 0.3);
        playerDesc.setTranslation(0, 2, 0);
        this.playerCollider = this.world.createCollider(playerDesc);

        this.ready = true;
        console.log('Rapier physics initialized');
        return this;
    }

    /**
     * Create a simple ground collider (cuboid) for flat terrain.
     * Making it massive and thick to prevent tunneling.
     */
    createGroundCollider(size) {
        // Create a static rigid body for the ground
        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        const body = this.world.createRigidBody(bodyDesc);

        // Huge size to act as infinite plane
        const infiniteSize = 100000;
        // Thick floor (height 10) to prevent tunneling 
        // Top surface at y=0 -> Center at y=-5
        const height = 10;
        const colliderDesc = RAPIER.ColliderDesc.cuboid(infiniteSize, height / 2, infiniteSize);
        colliderDesc.setTranslation(0, -height / 2, 0);

        const collider = this.world.createCollider(colliderDesc, body);
        this.colliders.push(collider);
        console.log(`Created massive ground collider (200,000 x 200,000)`);
        return collider;
    }

    /**
     * Create a trimesh collider from a Three.js mesh.
     * This allows pixel-perfect collision with complex GLB geometry.
     */
    createTrimeshCollider(mesh) {
        if (!mesh.geometry) {
            console.warn('Mesh has no geometry:', mesh.name);
            return null;
        }

        // Get world-space geometry
        mesh.updateMatrixWorld(true);
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);

        // Extract vertices
        const positionAttr = geometry.attributes.position;
        const vertices = new Float32Array(positionAttr.count * 3);
        for (let i = 0; i < positionAttr.count; i++) {
            vertices[i * 3] = positionAttr.getX(i);
            vertices[i * 3 + 1] = positionAttr.getY(i);
            vertices[i * 3 + 2] = positionAttr.getZ(i);
        }

        // Extract indices (or generate them if not indexed)
        let indices;
        if (geometry.index) {
            indices = new Uint32Array(geometry.index.array);
        } else {
            // Non-indexed geometry: create sequential indices
            indices = new Uint32Array(positionAttr.count);
            for (let i = 0; i < positionAttr.count; i++) {
                indices[i] = i;
            }
        }

        // Create trimesh collider
        try {
            const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
            const collider = this.world.createCollider(colliderDesc);
            this.colliders.push(collider);
            console.log(`Created trimesh collider for: ${mesh.name || 'unnamed'} (${indices.length / 3} triangles)`);
            return collider;
        } catch (e) {
            console.error('Failed to create trimesh for', mesh.name, e);
            return null;
        }
    }

    /**
     * Remove a collider from the world
     */
    removeCollider(collider) {
        if (!collider) return;
        this.world.removeCollider(collider, false); // false = don't remove rigid body (unless we want to?)
        // Note: modify colliders list if needed, but simple removal is fine for now
        const index = this.colliders.indexOf(collider);
        if (index > -1) {
            this.colliders.splice(index, 1);
        }
        console.log('Collider removed');
    }

    /**
     * Add all meshes from a Three.js scene/model as colliders
     */
    addModelColliders(model, excludeNames = []) {
        let count = 0;
        model.traverse((child) => {
            if (child.isMesh) {
                if (excludeNames.includes(child.name)) {
                    console.log(`Skipping collision for excluded object: ${child.name}`);
                    return;
                }
                const collider = this.createTrimeshCollider(child);
                if (collider) count++;
            }
        });
        console.log(`Added ${count} colliders from model`);
    }

    /**
     * Move the player using the character controller.
     * Returns the corrected position after collision resolution.
     */
    movePlayer(currentPosition, desiredMovement, delta) {
        if (!this.ready || !this.playerController) return currentPosition;

        // Set player collider position
        this.playerCollider.setTranslation({
            x: currentPosition.x,
            y: currentPosition.y - 0.7, // Offset for capsule center
            z: currentPosition.z
        });

        // Compute movement with collision
        this.playerController.computeColliderMovement(
            this.playerCollider,
            { x: desiredMovement.x, y: desiredMovement.y, z: desiredMovement.z }
        );

        // Get corrected movement
        const correctedMovement = this.playerController.computedMovement();

        return new THREE.Vector3(
            currentPosition.x + correctedMovement.x,
            currentPosition.y + correctedMovement.y,
            currentPosition.z + correctedMovement.z
        );
    }

    /**
     * Check if player is grounded
     */
    isGrounded() {
        if (!this.playerController) return true;
        return this.playerController.computedGrounded();
    }

    /**
     * Step the physics simulation
     */
    step(delta) {
        if (!this.ready) return;
        this.world.step();
    }

    /**
     * Raycast downward to find ground height at a position
     */
    raycastDown(x, z, fromY = 100) {
        if (!this.ready) return 0;

        const ray = new RAPIER.Ray(
            { x: x, y: fromY, z: z },
            { x: 0, y: -1, z: 0 }
        );

        const hit = this.world.castRay(ray, 200, true);
        if (hit) {
            return fromY - hit.timeOfImpact;
        }
        return 0;
    }
}
