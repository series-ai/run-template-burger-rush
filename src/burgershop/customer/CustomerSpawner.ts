import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Customer } from "./Customer"
import { BurgerShopDirectory } from "@game"
import {
    CUSTOMER_SPAWN_INTERVAL_MIN,
    CUSTOMER_SPAWN_INTERVAL_MAX,
    CUSTOMER_INITIAL_COUNT,
    LEVEL_CUSTOMER_MAX_IN_LINE,
} from "../BurgerShopBalanceConfig"
import { LevelingSystem } from "../leveling"

export class CustomerSpawner extends Component {
    // Item type this spawner creates customers for
    private readonly itemType: string

    // Spawn settings - positions from prefabs
    private readonly spawnPositions: THREE.Vector3[]
    private readonly initialSpawnPositions: THREE.Vector3[]

    // Timing
    private spawnTimer: number = 0
    private nextSpawnTime: number = 0

    // Management
    private customersSpawned: number = 0
    private pool: Customer[] = [] // Instance-specific pool (not shared between spawners)
    private totalCustomersCreated: number = 0 // Track total created for lazy instantiation

    constructor(
        itemType: string = "burger",
        spawnPositions: THREE.Vector3[],
        initialSpawnPositions: THREE.Vector3[]
    ) {
        super()
        this.itemType = itemType
        this.spawnPositions = spawnPositions
        this.initialSpawnPositions = initialSpawnPositions
    }

    public returnToPool(customer: Customer): void {
        this.pool.push(customer)
    }

    protected onCreate(): void {
        this.scheduleNextSpawn()
    }

    /**
     * Create a new customer on-demand (lazy instantiation)
     */
    private createNewCustomer(): Customer {
        this.totalCustomersCreated++
        const customerObject = new GameObject(`PooledCustomer_${this.itemType}_${this.totalCustomersCreated}`)
        customerObject.position.set(0, 0, 0)
        customerObject.setEnabled(false)
        const customer = new Customer()
        customerObject.addComponent(customer)
        customerObject.setEnabled(false)

        // Store reference to spawner so customer can return to correct pool
        customer.setSpawner(this)
        
        return customer
    }

    /**
     * Schedule the next spawn time
     */
    private scheduleNextSpawn(): void {
        this.spawnTimer = 0
        
        const min = CUSTOMER_SPAWN_INTERVAL_MIN
        const max = CUSTOMER_SPAWN_INTERVAL_MAX
        
        this.nextSpawnTime = min + Math.random() * (max - min)
    }

    public update(deltaTime: number): void {
        this.spawnTimer += deltaTime

        // Check if we can spawn: have available customer (pool or can create new) and conditions met
        const canSpawn = this.spawnTimer >= this.nextSpawnTime &&
            this.areRequiredStationsAcquired() && 
            this.anyNewCustomerNeeded()
        if (canSpawn) {
            this.spawnCustomer()
            this.scheduleNextSpawn()
        }
    }

    /**
     * Spawn a customer - either reuse from pool or create new (lazy instantiation)
     */
    private spawnCustomer(): void {
        // Use closer positions for initial customers
        const isInitialCustomer = this.customersSpawned < CUSTOMER_INITIAL_COUNT
        const positions = isInitialCustomer ? this.initialSpawnPositions : this.spawnPositions
        
        const randomIndex = Math.floor(Math.random() * positions.length)
        const spawnPosition = positions[randomIndex].clone()

        // Get customer from pool, or create new if pool is empty (lazy instantiation)
        const customer = this.pool.length > 0 ? this.pool.pop()! : this.createNewCustomer()
        
        customer.getGameObject().position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z)
        customer.Spawn(this.itemType)
        
        this.customersSpawned++
    }

    /**
     * Check if all required stations are acquired/active
     */
    private areRequiredStationsAcquired(): boolean {
        // Check if there's at least one active station of each required type
        const hasActiveBurgerStation =
            BurgerShopDirectory.getActiveBurgerStations().length > 0
        const hasActiveCheckoutStation =
            BurgerShopDirectory.getCheckoutStationByItemType(this.itemType) !== null
        const hasActiveTable = BurgerShopDirectory.getActiveTables().length > 0

        return hasActiveBurgerStation && hasActiveCheckoutStation && hasActiveTable
    }

    private anyNewCustomerNeeded(): boolean {
        const checkoutStation = BurgerShopDirectory.getCheckoutStationByItemType(this.itemType)
        const level = LevelingSystem.getLevel()
        const maxInLine = LEVEL_CUSTOMER_MAX_IN_LINE[Math.min(level - 1, LEVEL_CUSTOMER_MAX_IN_LINE.length - 1)]

        return checkoutStation != null && checkoutStation.getCustomersInLineCount() < maxInLine
    }
}
