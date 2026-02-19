import { Component, GameObject } from "@series-inc/rundot-3d-engine";
import * as THREE from "three";
import { Pickup } from "./Pickup";
import { Timer } from "@game/Timer";
import { BurgerShopDirectory } from "../BurgerShopDirectory";
import { LevelingSystem } from "@game/leveling/LevelingSystem";
import { PICKUP_SPAWN_TIME } from "../BurgerShopBalanceConfig";
import { PickupManager } from "./PickupManager";

type PickupFactory = () => Pickup

export class PickupSpawner extends Component {
    // Spawn settings - positions from prefabs
    private readonly spawnPositionsByLevel!: THREE.Vector3[][]
    private readonly pickupFactories!: PickupFactory[]
    private readonly camera!: THREE.Camera

    private spawnTimer: Timer = new Timer(5) // Initial pickup spawns very fast, then is set later to PICKUP_SPAWN_TIME

    constructor(spawnPositions: THREE.Vector3[][], pickupFactories: PickupFactory[], camera: THREE.Camera) {
        super()
        this.spawnPositionsByLevel = spawnPositions
        this.pickupFactories = pickupFactories
        this.camera = camera
    }

    public update(deltaTime: number): void {
        if (PickupManager.getPickupsDisabled()) return
        if (this.getPlayerLevel() < 2) return
        if (PickupManager.getBuffPickupActive()) return // pause the spawn timer while buffs are active
        if (PickupManager.getNumSpawnedPickups() >= 1) return // pause the spawn timer if there is already a pickup spawned

        this.spawnTimer.tick(deltaTime)

        // Check if we can spawn: have available customer (pool or can create new) and conditions met
        const canSpawn = this.spawnTimer.isDone()
        if (canSpawn) {
            this.spawnPickup()
        }
    }

    private spawnPickup(): void {
        this.spawnTimer = new Timer(PICKUP_SPAWN_TIME)
        this.spawnTimer.reset()
        const pickupFactory = this.pickupFactories[Math.floor(Math.random() * this.pickupFactories.length)]
        const spawnPosition = this.chooseSpawnPosition()

        const pickupObject = new GameObject(`Pickup_${Date.now()}`)
        pickupObject.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)

        const pickup = pickupFactory()
        pickupObject.addComponent(pickup)
        pickup.setCamera(this.camera)
    }

    private chooseSpawnPosition(): THREE.Vector3 {
        let closestSpawnPosition = new THREE.Vector3(1000, 1000, 1000)
        try {
            const playerPosition = this.getPlayerPosition()
            const levelIndex = Math.min(this.getEnvironmentLevel(), this.spawnPositionsByLevel.length - 1)
            const spawnPositions = this.spawnPositionsByLevel[levelIndex]
            let closestDistance = closestSpawnPosition.distanceTo(playerPosition)
            let closestIndex = 0;

            let index = 0;
            for (const spawnPosition of spawnPositions) {
                const distance = spawnPosition.distanceTo(playerPosition)
                index++;

                if (distance < closestDistance) {
                    closestSpawnPosition = spawnPosition
                    closestDistance = distance
                    closestIndex = index;
                }
            }
        } catch (error) {
            console.error("Error choosing spawn position:", error)
        }

        return closestSpawnPosition
    }

    private getPlayerPosition(): THREE.Vector3 {
        const player = BurgerShopDirectory.getPlayer()
        if (!player) {
            return new THREE.Vector3(0, 0, 0)
        }
        return player.position
    }

    private getPlayerLevel(): number {
        return LevelingSystem.getLevel();
    }

    private getEnvironmentLevel(): number {
        const environment = BurgerShopDirectory.getEnvironment()
        if (!environment) {
            return 0
        }
        return environment.getCurrentLevel()
    }
}