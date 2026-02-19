import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { SelfCheckoutCustomer } from "./SelfCheckoutCustomer"
import { BurgerShopDirectory } from "@game"
import {
    SELF_CHECKOUT_SPAWN_INTERVAL_MIN,
    SELF_CHECKOUT_SPAWN_INTERVAL_MAX,
    SELF_CHECKOUT_MAX_CUSTOMERS_IN_LINE,
} from "../BurgerShopBalanceConfig"

export class SelfCheckoutCustomerSpawner extends Component {
    // Spawn settings - positions from prefabs
    private readonly spawnPositions: THREE.Vector3[]

    // Timing
    private spawnTimer: number = 0
    private nextSpawnTime: number = 0

    // Management
    private static pool: SelfCheckoutCustomer[] = []
    private static totalCustomersCreated: number = 0 // Track total created for lazy instantiation

    constructor(spawnPositions: THREE.Vector3[]) {
        super()
        this.spawnPositions = spawnPositions
    }

    public static ReturnToPool(customer: SelfCheckoutCustomer): void {
        SelfCheckoutCustomerSpawner.pool.push(customer)
    }

    protected onCreate(): void {
        this.scheduleNextSpawn()
    }

    /**
     * Create a new customer on-demand (lazy instantiation)
     */
    private static createNewCustomer(): SelfCheckoutCustomer {
        SelfCheckoutCustomerSpawner.totalCustomersCreated++
        const customerObject = new GameObject(`PooledSelfCheckoutCustomer_${SelfCheckoutCustomerSpawner.totalCustomersCreated}`)
        customerObject.position.set(0, 0, 0)
        customerObject.setEnabled(false)
        const customer = new SelfCheckoutCustomer()
        customerObject.addComponent(customer)
        customerObject.setEnabled(false)

        return customer
    }

    /**
     * Schedule the next spawn time
     */
    private scheduleNextSpawn(): void {
        this.spawnTimer = 0
        this.nextSpawnTime = SELF_CHECKOUT_SPAWN_INTERVAL_MIN + Math.random() * (SELF_CHECKOUT_SPAWN_INTERVAL_MAX - SELF_CHECKOUT_SPAWN_INTERVAL_MIN)
    }

    public update(deltaTime: number): void {
        this.spawnTimer += deltaTime

        // Check if we can spawn: have available customer (pool or can create new) and conditions met
        const canSpawn = this.spawnTimer >= this.nextSpawnTime &&
            this.isSelfCheckoutStationActive() &&
            this.selfCheckoutCustomerNeeded()

        if (canSpawn) {
            this.spawnCustomer()
            this.scheduleNextSpawn()
        }
    }

    /**
     * Spawn a customer - either reuse from pool or create new (lazy instantiation)
     */
    private spawnCustomer(): void {
        const randomIndex = Math.floor(Math.random() * this.spawnPositions.length)
        const spawnPosition = this.spawnPositions[randomIndex].clone()

        // Get customer from pool, or create new if pool is empty (lazy instantiation)
        const customer = SelfCheckoutCustomerSpawner.pool.length > 0 
            ? SelfCheckoutCustomerSpawner.pool.pop()! 
            : SelfCheckoutCustomerSpawner.createNewCustomer()
        
        customer.getGameObject().position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)
        customer.Spawn()
    }

    /**
     * Check if self-checkout station is active
     */
    private isSelfCheckoutStationActive(): boolean {
        // Check if there's at least one active self-checkout station
        const hasActiveSelfCheckoutStation =
            BurgerShopDirectory.getActiveSelfCheckoutStations().length > 0

        return hasActiveSelfCheckoutStation
    }

    private selfCheckoutCustomerNeeded(): boolean {
        const selfCheckoutStations = BurgerShopDirectory.getActiveSelfCheckoutStations()

        for (const station of selfCheckoutStations) {
            if (station.getCustomersInLineCount() < SELF_CHECKOUT_MAX_CUSTOMERS_IN_LINE) {
                return true
            }
        }

        return false;
    }
}

