import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { VIPCustomer } from "./VIPCustomer"
import {
    VIP_CUSTOMER_SPAWN_INTERVAL_MIN,
    VIP_CUSTOMER_SPAWN_INTERVAL_MAX,
} from "../BurgerShopBalanceConfig"
import { Timer } from "@game/Timer"
import { BurgerShopDirectory } from "@game/BurgerShopDirectory"
import { LevelingSystem } from "@game/leveling"
import { TutorialTracker } from "@game/tutorial"

export class VIPCustomerSpawner extends Component {
    // Spawn settings - positions from prefabs
    private readonly spawnPositions: THREE.Vector3[]
    private readonly orderPositionsByLevel!: THREE.Vector3[][]

    // Timing
    private spawnTimer: Timer = new Timer(5) // First spawn is fast then uses values from balance config

    // Management
    private static pool: VIPCustomer[] = []
    private static totalCustomersCreated: number = 0 // Track total created for lazy instantiation
    private static activeVIPs: Set<VIPCustomer> = new Set()

    private tutorialTracker: TutorialTracker = TutorialTracker.getInstance()

    constructor(spawnPositions: THREE.Vector3[], orderPositionsByLevel: THREE.Vector3[][]) {
        super()
        this.spawnPositions = spawnPositions
        this.orderPositionsByLevel = orderPositionsByLevel
    }

    public static ReturnToPool(customer: VIPCustomer): void {
        VIPCustomerSpawner.pool.push(customer)
        VIPCustomerSpawner.activeVIPs.delete(customer)
    }

    protected onCreate(): void {
        this.spawnTimer.reset()
    }

    /**
     * Create a new customer on-demand (lazy instantiation)
     */
    private static createNewCustomer(): VIPCustomer {
        VIPCustomerSpawner.totalCustomersCreated++
        const customerObject = new GameObject(`PooledVIPCustomer_${VIPCustomerSpawner.totalCustomersCreated}`)
        customerObject.position.set(0, 0, 0)
        customerObject.setEnabled(false)
        const customer = new VIPCustomer()
        customerObject.addComponent(customer)
        customerObject.setEnabled(false)

        return customer
    }

    /**
     * Schedule the next spawn time
     */
    private scheduleNextSpawn(): void {
        const spawnTime = VIP_CUSTOMER_SPAWN_INTERVAL_MIN + Math.random() * (VIP_CUSTOMER_SPAWN_INTERVAL_MAX - VIP_CUSTOMER_SPAWN_INTERVAL_MIN)
        this.spawnTimer = new Timer(spawnTime)
        this.spawnTimer.reset()
    }

    public update(deltaTime: number): void {
        if (VIPCustomerSpawner.activeVIPs.size > 0 || !this.tutorialTracker.isTutorialCompleted()) {
            return
        }

        this.spawnTimer.tick(deltaTime)

        if (this.spawnTimer.isDone()) {
            this.spawnCustomer()
            this.scheduleNextSpawn()
        }
    }

    /**
     * Spawn a customer - either reuse from pool or create new (lazy instantiation)
     */
    private spawnCustomer(): void {
        let randomIndex = Math.floor(Math.random() * this.spawnPositions.length)
        const spawnPosition = this.spawnPositions[randomIndex].clone()

        const levelIndex = Math.min(this.getEnvironmentLevel(), this.orderPositionsByLevel.length - 1)
        randomIndex = Math.floor(Math.random() * this.orderPositionsByLevel[levelIndex].length)
        const orderPosition = this.orderPositionsByLevel[levelIndex][randomIndex].clone()

        // Get customer from pool, or create new if pool is empty (lazy instantiation)
        const customer = VIPCustomerSpawner.pool.length > 0
            ? VIPCustomerSpawner.pool.pop()!
            : VIPCustomerSpawner.createNewCustomer()

        customer.getGameObject().position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)
        customer.Spawn(orderPosition)
        VIPCustomerSpawner.activeVIPs.add(customer)
    }

    private getEnvironmentLevel(): number {
        const environment = BurgerShopDirectory.getEnvironment()
        if (!environment) {
            return 0
        }
        return environment.getCurrentLevel()
    }

    private getPlayerLevel(): number {
        return LevelingSystem.getLevel();
    }
}

