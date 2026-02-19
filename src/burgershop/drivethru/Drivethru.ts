import * as THREE from "three"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import {
    CostManager,
    IUnlockable,
    MoneyPile,
    PurchaseArea,
    UnlockManager,
} from "@game/money"
import { CarManager } from "./CarManager"
import { Car } from "./Car"
import { DriveThruEnvironment } from "./DriveThruEnvironment"
import { Burger } from "@game/burger-station"
import { ItemDropoffZone, AnimationUtils } from "@game/shared"
import { MeshRenderer } from "@series-inc/rundot-3d-engine"
import { StowKitSystem, ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"
import { InteractionAreaDisplay } from "@game/checkout-station"
import { BurgerShopDirectory, PlayerComponent } from "@game"
import { Audio2D, Particle, PrefabLoader, SplineThree } from "@series-inc/rundot-3d-engine/systems"
import { OrderIndicatorSystem } from "../ui/OrderIndicatorSystem"
import { OrderIndicator } from "@game/ui"
import type { ICanHaveCashier } from "@game/cashier"
import { CanCheckout, Cashier } from "@game/cashier"
import { Timer } from "@game/Timer"
import { PrefabInstance } from "@game/prefabs"
import {
    DRIVETHRU_MAX_CARS,
    DRIVETHRU_CAR_SPACING,
    DRIVETHRU_SPAWN_INTERVAL_MIN,
    DRIVETHRU_SPAWN_INTERVAL_MAX,
    DRIVETHRU_WINDOW_POSITION,
    CASHIER_CHECKOUT_SPEEDS,
    PLAYER_CHECKOUT_SPEED,
} from "../BurgerShopBalanceConfig"

/**
 * Three.js version of the drive-thru system
 * Combines all drive-thru functionality including purchase system, car management,
 * checkout logic, employee zones, and money integration
 */
export class Drivethru
    extends Component
    implements IUnlockable, ICanHaveCashier {
    // Constants
    private static readonly CHECKOUT_OBJECT_POSITION = new THREE.Vector3(
        13.5,
        0,
        8.5,
    ) // Cash register position
    private static readonly CHECKOUT_ZONE_POSITION = new THREE.Vector3(
        1.3,
        0,
        2.5,
    ) // Position relative to checkout object

    // Purchase system
    private readonly purchaseAreaComponent: PurchaseArea
    private readonly purchaseAreaObject: GameObject
    private costKey: string

    // Drive-thru environment (created immediately, transitions states)
    private driveThruEnvironment: DriveThruEnvironment | null = null
    private driveThruEnvironmentObject: GameObject | null = null

    // Drive-thru operational components (only created when acquired)
    private carManager: CarManager | null = null
    private carManagerObject: GameObject | null = null

    // Drive-thru window visual and interaction components
    private readonly checkoutObject: GameObject
    private checkoutZone: InteractionZone | null = null
    private entitiesInCheckoutZone: Set<GameObject> = new Set()

    // Checkout system (only active when acquired)
    private moneyPile: MoneyPile | null = null
    private moneyPileObject: GameObject | null = null

    // Burger collection
    private itemDropoff: ItemDropoffZone | null = null

    // Order processing state and shared indicator
    private orderIndicator: OrderIndicator | null = null // Shared indicator for all cars

    // Shared material (passed in constructor like Babylon.js version)
    private sharedMaterial?: THREE.Material

    // Transaction particle effects
    private transactionParticleComponent: ParticleSystemPrefabComponent | null = null
    private transactionParticleObject: GameObject | null = null

    // Audio component
    private audioComponent: Audio2D | null = null

    // Cashier reference
    private cashier: Cashier | null = null
    private readonly cashierLocation: PrefabInstance
    private readonly cashierPurchaseArea: PrefabInstance

    // Interaction area display
    private interactionAreaDisplay: InteractionAreaDisplay | null = null

    // Stack position from prefab
    private readonly stackPosition: THREE.Vector3

    // Checkout speed configuration
    private cashierCheckoutTime: number = CASHIER_CHECKOUT_SPEEDS[0]  // Updated via onCashierSpeedChanged
    private checkoutTimer = new Timer(this.cashierCheckoutTime)

    // Drive-thru spline (passed from prefab)
    private readonly spline: SplineThree

    constructor(
        prefab: PrefabInstance,
        purchaseArea: PurchaseArea,
        spline: SplineThree,
        costKey: string = "drive_thru",
        sharedMaterial?: THREE.Material
    ) {
        super()
        this.costKey = costKey
        this.sharedMaterial = sharedMaterial
        this.spline = spline
        this.checkoutObject = prefab.getDescendantByPathOrThrow("checkout_display").gameObject
        this.checkoutObject.setEnabled(false)
        this.cashierLocation = prefab.getDescendantByPathOrThrow("cashier_location")
        this.cashierPurchaseArea = prefab.getDescendantByPathOrThrow("cashier_purchase_area")
        
        // Get stack position from prefab and transform to checkoutObject local space
        const stackPositionNode = prefab.getDescendantByPathOrThrow("stack_position")
        const stackWorldPos = stackPositionNode.gameObject.getWorldPosition(new THREE.Vector3())
        this.stackPosition = this.checkoutObject.worldToLocal(stackWorldPos)
        this.purchaseAreaComponent = purchaseArea
        this.purchaseAreaComponent.setOnCompleteCallback(() => UnlockManager.acquire(this))
        this.purchaseAreaObject = purchaseArea.getGameObject()
    }

    protected onCreate(): void {
        // Register with directory
        BurgerShopDirectory.registerDrivethru(this)

        // Create drive-thru environment (starts in pre-unlock state)
        this.createDriveThruEnvironment()

        // Purchase area starts disabled until unlocked by UnlockManager
        this.purchaseAreaObject.setEnabled(false)
        // Drive-thru created
    }

    protected onCleanup(): void {
        // Clean up order indicator
        if (this.orderIndicator) {
            this.orderIndicator.dispose()
            this.orderIndicator = null
        }

        // Clean up particle system
        if (this.transactionParticleObject) {
            this.transactionParticleObject.dispose()
        }

        // Unregister from directory (placeholder)
        // BurgerShopDirectory.unregisterDriveThru(`drivethru_${this.gameObject.name}`);
    }

    public update(deltaTime: number): void {
        if (!this.carManager) return // Only update when operational

        this.checkoutTimer.tick(deltaTime)

        // Collect burgers from entities
        if (this.itemDropoff) {
            this.itemDropoff.update(deltaTime)
        }

        // Process orders
        this.processOrders()
    }

    /**
     * Create the drive-thru environment (grass/trees initially, transitions to drivethru when acquired)
     */
    private createDriveThruEnvironment(): void {
        this.driveThruEnvironmentObject = new GameObject("DriveThruEnvironment")
        this.gameObject.add(this.driveThruEnvironmentObject)

        this.driveThruEnvironment = new DriveThruEnvironment(this.sharedMaterial)
        this.driveThruEnvironmentObject.addComponent(this.driveThruEnvironment)

        // Environment starts in pre-unlock state by default
    }

    /**
     * Called when drive-thru has been acquired (purchased)
     * @param fromStorage If true, this is being loaded from storage (skip animations)
     */
    public onAcquire(fromStorage: boolean = false): void {
        // Drive-thru purchased

        // Create operational components (window, zones, and car spawner)
        this.createOperationalComponents()

        // Animate the checkout bouncing in (but not when loading from storage)
        if (!fromStorage && this.checkoutObject) {
            AnimationUtils.animateIn(this.checkoutObject)
        }

        // Hide the purchase area since it's no longer needed
        this.purchaseAreaObject.setEnabled(false)
        this.checkoutObject.setEnabled(true)

        // Transition the environment to drivethru state
        if (this.driveThruEnvironment) {
            this.driveThruEnvironment.showDrivethruState()
        }

        // If using the combined v2 environment, swap the display asset
        // const envObject = this.scene.getObjectByName("Environment")
        // if (envObject && (envObject as any).getComponent) {
        //   const envComponent = (envObject as any).getComponent(
        //     BurgerShopEnvironment,
        //   ) as BurgerShopEnvironment | undefined
        //   envComponent?.switchRestaurantDisplay("drivethru")
        // }

        // Drive-thru operational
    }

    /**
     * Create the operational components (window, zones, and car spawner) when drive-thru is acquired
     */
    private createOperationalComponents(): void {
        // Create car manager for spawning and managing cars
        this.carManagerObject = new GameObject("DriveThruCarManager")
        this.gameObject.add(this.carManagerObject)

        this.carManager = new CarManager({
            spline: this.spline,
            maxCars: DRIVETHRU_MAX_CARS,
            spawnInterval: { min: DRIVETHRU_SPAWN_INTERVAL_MIN, max: DRIVETHRU_SPAWN_INTERVAL_MAX },
            driveThruWindowPosition: DRIVETHRU_WINDOW_POSITION,
            carSpacing: DRIVETHRU_CAR_SPACING,
        })
        this.carManagerObject.addComponent(this.carManager)

        // Setup money pile for earnings
        this.moneyPileObject = new GameObject("DriveThruMoneyPile")
        this.checkoutObject.add(this.moneyPileObject)
        this.moneyPileObject.position.set(1, 0, 5)
        this.moneyPile = new MoneyPile()
        this.moneyPileObject.addComponent(this.moneyPile)

        // Setup transaction particles at the window area using pfx_money prefab
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const moneyPrefab = prefabCollection.getPrefabByName("pfx_money")
        
        if (moneyPrefab) {
            const instance = PrefabLoader.instantiatePrefab(moneyPrefab, this.checkoutObject)
            this.transactionParticleObject = instance.gameObject
            
            // Get the Particle component from the instantiated prefab
            // Note: Use ParticleSystemPrefabComponent since getComponent uses exact class matching
            this.transactionParticleComponent = this.transactionParticleObject.getComponent(ParticleSystemPrefabComponent) ?? null
        } else {
            console.warn("pfx_money prefab not found, drive-thru transaction particles disabled")
        }

        this.checkoutZone = new InteractionZone(
            (entity: GameObject) => this.onEntityEnterCheckout(entity),
            (entity: GameObject) => this.onEntityExitCheckout(entity),
            {
                width: 2, // Same as checkout station's checkout zone
                depth: 2, // Same as checkout station's checkout zone
                active: true,
                show: false,
            },
        )
        this.cashierLocation.gameObject.addComponent(this.checkoutZone)

        // Add the interaction area display
        this.interactionAreaDisplay = new InteractionAreaDisplay()
        this.cashierLocation.gameObject.addComponent(this.interactionAreaDisplay)

        // Setup item dropoff zone for collecting burgers
        this.itemDropoff = new ItemDropoffZone({
            zoneSize: { width: 4, depth: 4 },
            zonePosition: new THREE.Vector3(this.stackPosition.x, 0, this.stackPosition.z),
            itemType: Burger.ITEM_TYPE,
            stackPositions: [this.stackPosition],
            audioClipName: "place burgers",
        })
        this.checkoutObject.addComponent(this.itemDropoff)

        // Set up the shared order indicator (use OrderIndicator as shared UI)
        // this.orderIndicator = new OrderIndicator({
        //     scene: this.gameObject.getScene(),
        //     heightOffset: 0 // Already positioned correctly
        // });

        // Get camera for order indicator
        // try {
        //     const scene = this.gameObject.getScene();
        //     const camera = scene.getObjectByName('Camera') as THREE.Camera;
        //     if (camera) {
        //         this.orderIndicator.attachTo(this.orderIndicatorObject, camera);
        //     }
        // } catch (error) {
        //     console.warn("DrivethruThree: Failed to set up order indicator camera:", error);
        // }

        // Setup audio system
        this.setupAudio()

        // Operational components created
    }

    /**
     * Setup the audio system for cash register sounds
     */
    private setupAudio(): void {
        this.audioComponent = new Audio2D(["cash register", "place burgers"])
        this.gameObject.addComponent(this.audioComponent)
    }

    /**
     * Process orders from cars at the window with ordering delay
     */
    private processOrders(): void {
        if (!this.carManager) return

        // Check if car is at window
        if (this.carManager.isFrontCarAtWindow()) {
            const frontCar = this.carManager.getFrontCar()

            // Always show indicator for front car
            if (frontCar && frontCar.getBurgerOrderCount() > 0) {

                // Show/update order indicator
                if (!this.orderIndicator || !this.orderIndicator.getIsVisible()) {
                    this.showOrderIndicator(frontCar.getBurgerOrderCount())
                }

                // Update indicator position
                const camera = OrderIndicatorSystem.getCamera()
                if (camera && this.orderIndicator) {
                    this.orderIndicator.update(frontCar.getCarGameObject(), camera)
                }

                this.tryDeliverBurgers(frontCar)
            }
        } else {
            // No car at window - hide indicator and reset all state
            this.hideOrderIndicator()
            this.checkoutTimer.reset()

            if (this.cashier) {
                this.cashier.setUsingRegister(false)
            }
        }
    }

    /**
     * Show the order indicator above the current car
     */
    private showOrderIndicator(orderCount: number): void {
        const frontCar = this.carManager?.getFrontCar()
        if (!frontCar) return

        // Create indicator if it doesn't exist
        if (!this.orderIndicator) {
            this.orderIndicator = OrderIndicatorSystem.createIndicator({
                burgerCount: orderCount,
                heightOffset: 2.5, // Cars are lower than customers
            })
        } else {
            // Update existing indicator
            this.orderIndicator.updateBurgerCount(orderCount)
        }

        // Attach to car and show
        const camera = OrderIndicatorSystem.getCamera()
        if (camera) {
            this.orderIndicator.attachTo(frontCar.getCarGameObject(), camera)
            this.orderIndicator.show()
            // Order indicator shown
        }
    }

    /**
     * Hide the order indicator
     */
    private hideOrderIndicator(): void {
        if (this.orderIndicator) {
            this.orderIndicator.hide()
        }
    }

    /**
     * Try to deliver burgers to the front car
     */
    private tryDeliverBurgers(car: Car): void {
        if (this.cashier) {
            this.cashier.setUsingRegister(false)
        }

        if (!this.isCashierPresent()) {
            this.checkoutTimer.reset()
            return
        }

        if (!this.itemDropoff || this.itemDropoff.isEmpty()) {
            this.checkoutTimer.reset()
            return
        }

        if (this.checkoutTimer.isRunning()) {
            if (this.cashier) {
                this.cashier.setUsingRegister(true)
            }
            return
        }

        const burgerPrice = CostManager.getCost("drive_thru_burger_price")
        this.moneyPile?.addMoney(burgerPrice)

        // Trigger transaction particle effect
        if (this.transactionParticleComponent) {
            this.transactionParticleComponent.trigger(10)
        }

        const carGameObject = car.getCarGameObject()
        const windowPosition = new THREE.Vector3(-1, 1.5, 0.5)

        const burger = this.itemDropoff.removeItem(Burger.ITEM_TYPE)
        if (!burger) {
            console.error("Expected at least one buger in checkout inventory")
            return
        }

        this.audioComponent?.play("cash register")
        this.checkoutTimer.reset()

        const newBurgerCount = car.giveBurger(burger)
        if (newBurgerCount === 0) {
            this.hideOrderIndicator()
            this.carManager?.removeFrontCarFromLine()
        } else {
            this.orderIndicator?.updateBurgerCount(newBurgerCount)
        }

        const positionTarget = new GameObject("itemPositionTarget")
        carGameObject.add(positionTarget)
        positionTarget.position.copy(new THREE.Vector3(-1, 1.5, 0.5))

        burger.animateToPosition(positionTarget, () => {
            const gameObject = burger.getGameObject()
            gameObject.dispose()
            positionTarget.removeFromParent()
            positionTarget.dispose()
        })
    }

    // IUnlockable implementation
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    public getDisplayName(): string {
        return "Drive-Thru"
    }

    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    public unlock(): void {
        // Enable purchase area when unlocked
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(fromStorage: boolean = false): void {
        // Handle local acquisition logic
        this.onAcquire(fromStorage)
    }

    /**
     * Get highlight position for camera showcasing (use checkout position instead of origin)
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        if (this.checkoutObject) {
            // Use the checkout object's world position (where player interacts)
            this.checkoutObject.getWorldPosition(outPosition)
        } else {
            // Fallback to where checkout will be positioned
            const checkoutPos = Drivethru.CHECKOUT_OBJECT_POSITION.clone()
            this.gameObject.localToWorld(checkoutPos)
            outPosition.copy(checkoutPos)
        }
    }

    /**
     * Get the car manager instance (for debugging)
     */
    public getCarManager(): CarManager | null {
        return this.carManager
    }

    private onEntityEnterCheckout(entity: GameObject): void {
        const canCheckout = entity.getComponent(CanCheckout)
        if (canCheckout) {
            this.entitiesInCheckoutZone.add(entity)

            // Update interaction area display - activate when first entity enters
            if (
                this.interactionAreaDisplay &&
                this.entitiesInCheckoutZone.size === 1
            ) {
                this.interactionAreaDisplay.setActive()
            }

            const player = entity.getComponent(PlayerComponent)
            if (player !== null) {
                this.checkoutTimer.duration = PLAYER_CHECKOUT_SPEED
                this.checkoutTimer.trigger()
            }
        }
    }

    private onEntityExitCheckout(entity: GameObject): void {
        const canCheckout = entity.getComponent(CanCheckout)
        if (canCheckout) {
            this.entitiesInCheckoutZone.delete(entity)

            // If zone is now empty AND no cashier assigned, deactivate
            if (
                this.interactionAreaDisplay &&
                this.entitiesInCheckoutZone.size === 0 &&
                !this.cashier
            ) {
                this.interactionAreaDisplay.setInactive()
            }

            const player = entity.getComponent(PlayerComponent)
            if (player !== null) {
                this.checkoutTimer.duration = this.cashierCheckoutTime
            }
        }
    }

    /**
     * Set the cashier reference for this drive-thru
     */
    public setCashier(cashier: Cashier | null): void {
        this.cashier = cashier

        // Update interaction area display if cashier is being set and no entities in zone
        if (
            cashier &&
            this.interactionAreaDisplay &&
            this.entitiesInCheckoutZone.size === 0
        ) {
            this.interactionAreaDisplay.setActive()
        } else if (
            !cashier &&
            this.interactionAreaDisplay &&
            this.entitiesInCheckoutZone.size === 0
        ) {
            this.interactionAreaDisplay.setInactive()
        }
    }

    public onCashierSpeedChanged(newSpeed: number): void {
        this.cashierCheckoutTime = newSpeed
        // Update timer duration if cashier is currently checking out
        if (this.cashier && this.entitiesInCheckoutZone.size === 0) {
            this.checkoutTimer.duration = newSpeed
        }
    }

    /**
     * Check if a cashier is present (either assigned cashier or entity in checkout zone)
     */
    private isCashierPresent(): boolean {
        return this.cashier !== null || this.entitiesInCheckoutZone.size > 0
    }

    // ICanHaveCashier implementation
    public getPurchaseAreaPosition(): THREE.Vector3 {
        const purchasePos = new THREE.Vector3()
        return this.cashierPurchaseArea.gameObject.getWorldPosition(purchasePos)
    }

    public getCashierPosition(): THREE.Vector3 {
        const cashierPos = new THREE.Vector3()
        return this.cashierLocation.gameObject.getWorldPosition(cashierPos)
    }

    public getCashierRotation(): THREE.Euler {
        return this.cashierLocation.gameObject.rotation
    }

    /**
     * Get the current inventory count (number of burgers)
     */
    public getInventoryCount(): number {
        return this.itemDropoff ? this.itemDropoff.getItemCount() : 0
    }

    /**
     * Get the delivery position for employees to navigate to
     * Returns the world position of the delivery interaction zone
     */
    public getDeliveryPosition(): THREE.Vector3 {
        if (this.itemDropoff) {
            return this.itemDropoff
                .getInteractionZoneObject()
                .getWorldPosition(new THREE.Vector3())
        }
        // Fallback to checkout position if delivery zone not available
        return this.gameObject.getWorldPosition(new THREE.Vector3())
    }

    /**
     * Get the item dropoff zone
     */
    public getItemDropoff(): ItemDropoffZone | null {
        return this.itemDropoff
    }
}
