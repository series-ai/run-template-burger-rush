import { BuffPickup } from "./BuffPickup"
import { Pickup } from "./Pickup"

export class PickupManager {
    private static INSTANCE: PickupManager
    private activeBuffPickups: Set<BuffPickup> = new Set<BuffPickup>()
    private spawnedPickups: Set<Pickup> = new Set<Pickup>()
    private pickupsDisabled: boolean = false

    private constructor() {
    }

    public static getInstance(): PickupManager {
        if (!PickupManager.INSTANCE) {
            PickupManager.INSTANCE = new PickupManager()
        }
        return PickupManager.INSTANCE
    }

    public static addSpawnedPickup(spawnedPickup: Pickup): void {
        console.log(`Adding spawned pickup: ${spawnedPickup.getGameObject()?.name}`)
        this.getInstance().spawnedPickups.add(spawnedPickup)
    }

    public static removeSpawnedPickup(spawnedPickup: Pickup): void {
        console.log(`Removing spawned pickup: ${spawnedPickup.getGameObject()?.name}`)
        this.getInstance().spawnedPickups.delete(spawnedPickup)
    }

    public static getNumSpawnedPickups(): number {
        return this.getInstance().spawnedPickups.size
    }

    public static addBuffPickup(buffPickup: BuffPickup): void {
        this.getInstance().activeBuffPickups.add(buffPickup)
    }

    public static removeBuffPickup(buffPickup: BuffPickup): void {
        this.getInstance().activeBuffPickups.delete(buffPickup)
    }

    public static getBuffPickupActive(): boolean {
        return this.getInstance().activeBuffPickups.size > 0
    }

    public static getPickupsDisabled(): boolean {
        return this.getInstance().pickupsDisabled
    }
}