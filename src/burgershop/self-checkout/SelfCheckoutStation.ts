import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import {
    RigidBodyComponentThree,
    RigidBodyType,
    ColliderShape,
    StowKitSystem,
    PrefabLoader,
} from "@series-inc/rundot-3d-engine/systems"
import { DynamicNavSystem, SplineThree, SplineTypeThree, Audio2D, Particle } from "@series-inc/rundot-3d-engine/systems"
import { IUnlockable, MoneyPile } from "@game/money/index"
import { PurchaseArea } from "@game/money/index"
import { UnlockManager } from "@game/money/index"
import { CostManager } from "@game/money/index"
import { Timer } from "@game/Timer"
import { ItemDropoffZone, AnimationUtils } from "@game/shared"
import { Burger } from "@game/burger-station"
import { BurgerShopDirectory, Item, OrderIndicator, UnlockableComponent } from "@game"
import { LineOfCustomers } from "@game/customer"
import { SelfCheckoutCustomer, SelfCheckoutCustomerState } from "./SelfCheckoutCustomer"
import { EmptyStackIndicator } from "./EmptyStackIndicator"
import { DecidingIndicator } from "./DecidingIndicator"
import { PrefabInstance, BoxComponentJSON } from "@game/prefabs"
import { Shake } from "@game/shake-station"
import { SELF_CHECKOUT_TIME } from "../BurgerShopBalanceConfig"

/**
 * Self-Checkout Station - allows customers to check out themselves
 * Simple placeholder implementation with white boxes for positioning
 */
export class SelfCheckoutStation extends Component implements IUnlockable {

    // Visual objects
    private burgerDropoff!: ItemDropoffZone
    private burgerStackPosition!: THREE.Vector3

    private shakeDropoff!: ItemDropoffZone
    private shakeStackPosition!: THREE.Vector3

    private moneyPile!: MoneyPile
    private moneyPileObject!: GameObject

    // Purchase system
    private purchaseArea: PurchaseArea | null = null
    private purchaseAreaObject: GameObject | null = null
    private costKey: string
    
    private checkoutTimer = new Timer(SELF_CHECKOUT_TIME) // Single timer for both lines

    // Order indicators (one for each line)
    private orderIndicator1!: OrderIndicator
    private orderIndicator2!: OrderIndicator

    // Deciding indicators (one for each line)
    private decidingIndicator1!: DecidingIndicator
    private decidingIndicator2!: DecidingIndicator

    // Empty stack indicator
    private emptyBurgerStackIndicator!: EmptyStackIndicator
    private emptyBurgerStackIndicatorObject!: GameObject

    private emptyShakeStackIndicator!: EmptyStackIndicator
    private emptyShakeStackIndicatorObject!: GameObject

    // Audio component
    private audioComponent: Audio2D | null = null

    // Customer lines (two lines for two kiosks)
    private customerLine1!: LineOfCustomers
    private lineSpline1: SplineThree
    private customerLinePosition: THREE.Vector3

    // Track if station has been acquired
    private isAcquired: boolean = false

    // Cached position for highlight system (purchase area gets disposed on acquire)
    private highlightPosition: THREE.Vector3 = new THREE.Vector3()

    // Reference to shake station for unlock checks
    private shakeStation!: UnlockableComponent


    private selfCheckoutInstance!: PrefabInstance
    private stationDisplay!: GameObject
    private wallDisplay!: GameObject
    private collisionParent!: GameObject

    constructor(lineSpline1: SplineThree, customerLinePosition: THREE.Vector3, shakeStation: UnlockableComponent, costKey: string = "self_checkout_station") {
        super()
        this.lineSpline1 = lineSpline1
        this.customerLinePosition = customerLinePosition
        this.costKey = costKey
        this.shakeStation = shakeStation
    }

    protected onCreate(): void {

        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const selfCheckoutPrefab = prefabCollection.getPrefabByName("self_checkout_station")
        if (!selfCheckoutPrefab) {
            console.error("self checkout prefab not found")
            return
        }
        
        this.selfCheckoutInstance = PrefabLoader.instantiatePrefab(selfCheckoutPrefab)


        this.stationDisplay = this.selfCheckoutInstance.getDescendantByPathOrThrow("/station_display").gameObject
        this.stationDisplay.setEnabled(false)
        
        this.wallDisplay = this.selfCheckoutInstance.getDescendantByPathOrThrow("/wall").gameObject
        this.wallDisplay.setEnabled(true)

        this.collisionParent = this.selfCheckoutInstance.getDescendantByPathOrThrow("/collision").gameObject
        this.collisionParent.setEnabled(false) // Disable station collision until acquired

        // Wall display should have RigidBody components for navigation/collision
        // Setup navigation obstacles for the wall (visible before station is acquired)
        this.setupNavigationObstacles(this.wallDisplay)

        this.setupPurchaseArea()
        
        // Setup item dropoff zone for collecting burgers
        this.setupItemDropoffZone()

        // Setup money pile
        this.setupMoneyPile()

        // Setup customer line (under station components)
        this.setupCustomerLine()

        // Setup audio system
        this.setupAudio()

        // Setup order indicators
        this.createOrderIndicators()

        // Setup deciding indicators
        this.createDecidingIndicators()

        // Setup empty stack indicator
        this.createEmptyStackIndicator()

        UnlockManager.addAcquireListener(this.acquireListener.bind(this))
    }


    public update(deltaTime: number): void {
        this.checkoutTimer.tick(deltaTime)

        // Collect burgers from entities
        this.burgerDropoff.update(deltaTime)

        this.shakeDropoff.update(deltaTime)

        // Process burgers if we have any
        this.tryCheckoutCustomers()

        // Update order indicators
        this.updateOrderIndicators()

        // Update deciding indicators
        this.updateDecidingIndicators(deltaTime)

        // Update empty stack indicator
        this.updateEmptyStackIndicator()
    }

    /**
     * Setup the item dropoff zone for collecting burgers
     */
    private setupItemDropoffZone(): void {
        // Get burger stack position from prefab reference
        const burgerStackPrefab = this.selfCheckoutInstance.getDescendantByPathOrThrow("burgerstack")
        this.burgerStackPosition = burgerStackPrefab.gameObject.position.clone()

        // Create new GameObject for burger dropoff zone (at ground level, y=0)
        const burgerDropoffObject = new GameObject("BurgerDropoffZone")
        burgerDropoffObject.position.set(this.burgerStackPosition.x, 0, this.burgerStackPosition.z)
        this.selfCheckoutInstance.gameObject.add(burgerDropoffObject)

        this.burgerDropoff = new ItemDropoffZone({
            zoneSize: { width: 4, depth: 4 },
            zonePosition: new THREE.Vector3(0, 0, 0),
            itemType: Burger.ITEM_TYPE,
            stackPositions: [
                new THREE.Vector3(0, this.burgerStackPosition.y, 0),
            ],
            audioClipName: "place burgers"
        })
        burgerDropoffObject.addComponent(this.burgerDropoff)

        // Get shake stack position from prefab reference
        const shakeStackPrefab = this.selfCheckoutInstance.getDescendantByPathOrThrow("shakestack")
        this.shakeStackPosition = shakeStackPrefab.gameObject.position.clone()

        // Create new GameObject for shake dropoff zone (at ground level, y=0)
        const shakeDropoffObject = new GameObject("ShakeDropoffZone")
        shakeDropoffObject.position.set(this.shakeStackPosition.x, 0, this.shakeStackPosition.z)
        this.selfCheckoutInstance.gameObject.add(shakeDropoffObject)

        this.shakeDropoff = new ItemDropoffZone({
            zoneSize: { width: 4, depth: 4 },
            zonePosition: new THREE.Vector3(0, 0, 0),
            itemType: Shake.ITEM_TYPE,
            stackPositions: [
                new THREE.Vector3(0, this.shakeStackPosition.y, 0),
            ],
            audioClipName: "place burgers",
        })
        shakeDropoffObject.addComponent(this.shakeDropoff)
    }



    /**
     * Setup navigation obstacles for all GameObjects with RigidBody components
     */
    private setupNavigationObstacles(instance: GameObject): void {
        // Traverse all children to find GameObjects with RigidBody components
        instance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Get bounds from the RigidBody component
                const bounds = rigidBody.getBounds()
                const boundsSize = bounds.getSize(new THREE.Vector3())

                // Add rotated navigation obstacle (registers with GameObject UUID for proper cleanup)
                DynamicNavSystem.addRotatedBoxObstacle(child, boundsSize)
            }
        })
    }

    /**
     * Remove navigation obstacles for all GameObjects with RigidBody components
     */
    private removeNavigationObstacles(instance: GameObject): void {
        instance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component (indicates it has a nav obstacle)
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Remove the navigation obstacle for this GameObject
                DynamicNavSystem.removeObstacleByGameObject(child)
            }
        })
    }

    /**
     * Setup the money pile system
     */
    private setupMoneyPile(): void {
        // Get money_pile position from prefab
        const moneyPilePrefab = this.selfCheckoutInstance.getDescendantByPathOrThrow("/money_pile")
        
        this.moneyPileObject = new GameObject("MoneyPile")
        this.moneyPileObject.position.copy(moneyPilePrefab.gameObject.position)
        this.selfCheckoutInstance.gameObject.add(this.moneyPileObject)

        this.moneyPile = new MoneyPile()
        this.moneyPileObject.addComponent(this.moneyPile)
    }

    /**
     * Setup the audio system for burger placement sounds
     */
    private setupAudio(): void {
        this.audioComponent = new Audio2D([
            "place burgers",
            "cash register",
        ])
        this.gameObject.addComponent(this.audioComponent)
    }

    /**
     * Setup the customer line components
     */
    private setupCustomerLine(): void {
        // Create customer line GameObject with position from prefab
        const customerLineObject = new GameObject("SelfCheckoutCustomerLine")
        customerLineObject.position.copy(this.customerLinePosition)
        this.selfCheckoutInstance.gameObject.add(customerLineObject)

        // Create the line component with the spline
        this.customerLine1 = new LineOfCustomers({
            spline: this.lineSpline1,
            spacing: 3.0, // Space between customers in line
        })
        customerLineObject.addComponent(this.customerLine1)
    }

    /**
     * Helper to create a white box mesh with physics
     */
    private createWhiteBox(
        parent: GameObject,
        width: number,
        height: number,
        depth: number,
        name: string
    ): void {
        const geometry = new THREE.BoxGeometry(width, height, depth)
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.7,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.position.y = height / 2 // Center the box vertically
        parent.add(mesh)

        // Add physics collider
        const physics = new RigidBodyComponentThree({
            type: RigidBodyType.STATIC,
            shape: ColliderShape.BOX,
            size: new THREE.Vector3(width, height, depth),
            centerOffset: new THREE.Vector3(0, height / 2, 0),
        })
        parent.addComponent(physics)
    }

    /**
     * Setup the purchase area for this self-checkout station
     */
    private setupPurchaseArea(): void {
        // Get purchase_area descendant from prefab for position and size
        const purchaseAreaPrefabInstance = this.selfCheckoutInstance.getDescendantByPathOrThrow("/purchase_area")
        const purchaseAreaBoxData = purchaseAreaPrefabInstance.prefabNode.getComponentData<BoxComponentJSON>("box")
        if (!purchaseAreaBoxData) {
            throw new Error("Self-checkout station purchase_area must have a box component")
        }
        
        // Get position from prefab
        const purchaseAreaPosition = purchaseAreaPrefabInstance.gameObject.position.clone()
        
        // Get size from box component data
        const purchaseAreaSize = new THREE.Vector2(purchaseAreaBoxData.size[0], purchaseAreaBoxData.size[2])

        // Create purchase area as independent object
        this.purchaseAreaObject = new GameObject("SelfCheckoutStationPurchaseArea")

        // Use position from prefab
        this.purchaseAreaObject.position.copy(purchaseAreaPosition)

        // Cache position for highlight system (purchase area gets disposed on acquire)
        this.highlightPosition.copy(purchaseAreaPosition)

        // Create the purchase area component using size from prefab box
        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            purchaseAreaSize,
            "Self Checkout",
            () => UnlockManager.acquire(this), // Completion callback
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)

        // Add to scene
        this.gameObject.parent?.add(this.purchaseAreaObject)

        // Purchase area starts disabled - will be enabled when unlocked
        this.purchaseAreaObject.setEnabled(false)
    }

    // IUnlockable implementation

    /**
     * Called when this item becomes available for purchase
     */ 
    public unlock(): void {
        // Enable the purchase area so player can buy it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Called when this item has been acquired (purchased/built)
     * @param fromStorage Whether loading from saved state (skip animation)
     */
    public acquire(fromStorage: boolean = false): void {
        // Mark as acquired
        this.isAcquired = true

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Remove wall navigation obstacles before disabling
        this.removeNavigationObstacles(this.wallDisplay)

        if (fromStorage) {
            // Instant transition when loading from storage
            this.wallDisplay.setEnabled(false)
            this.stationDisplay.setEnabled(true)
            this.collisionParent.setEnabled(true)
            
            // Add navigation obstacles now that station is active
            this.setupNavigationObstacles(this.collisionParent)

            // Register with directory now that station is active
            BurgerShopDirectory.registerSelfCheckoutStation(this)
        } else {
            // Animate out the wall, then animate in the station display
            AnimationUtils.animateOut(this.wallDisplay, () => {
                this.wallDisplay.setEnabled(false)

                // Show and animate in the station display
                this.stationDisplay.setEnabled(true)
                this.collisionParent.setEnabled(true)
                AnimationUtils.animateIn(this.stationDisplay)
                
                // Add navigation obstacles now that station is active
                this.setupNavigationObstacles(this.collisionParent)

                // Register with directory now that station is active
                BurgerShopDirectory.registerSelfCheckoutStation(this)
            })
        }
    }

    /**
     * Get the cost of this self-checkout station
     */
    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    /**
     * Get display name for logging/debugging
     */
    public getDisplayName(): string {
        return "Self Checkout"
    }

    /**
     * Get the unique ID for this unlockable item
     */
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    /**
     * Set camera for UI updates
     */
    public setCameraForUI(camera: THREE.Camera): void {
        if (this.purchaseArea) {
            this.purchaseArea.setCamera(camera)
        }
    }

    /**
     * Get highlight position for tutorial/unlock highlight systems
     * Returns the purchase area position for camera highlighting
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        outPosition.copy(this.highlightPosition)
    }

    /**
     * Create empty stack indicator
     */
    private createEmptyStackIndicator(): void {
        // Create a GameObject for the indicator at the item stack position
        this.emptyBurgerStackIndicatorObject = new GameObject("EmptyStackIndicator")
        
        // Position at the stored stack position
        this.emptyBurgerStackIndicatorObject.position.copy(this.burgerStackPosition)
        this.stationDisplay.add(this.emptyBurgerStackIndicatorObject)

        this.emptyBurgerStackIndicator = new EmptyStackIndicator({
            itemType: "burger",
            heightOffset: 0.5,
        })
        this.emptyBurgerStackIndicator.attachTo(this.emptyBurgerStackIndicatorObject, BurgerShopDirectory.getMainCamera()!)

        this.emptyShakeStackIndicatorObject = new GameObject("EmptyShakeStackIndicator")
        this.emptyShakeStackIndicatorObject.position.copy(this.shakeStackPosition)
        this.stationDisplay.add(this.emptyShakeStackIndicatorObject)

        this.emptyShakeStackIndicator = new EmptyStackIndicator({
            itemType: "shake",
            heightOffset: 0.5,
        })
        this.emptyShakeStackIndicator.attachTo(this.emptyShakeStackIndicatorObject, BurgerShopDirectory.getMainCamera()!)
        
        // Don't show initially - will be shown after acquisition if needed
    }

    /**
     * Update empty stack indicator based on inventory
     */
    private updateEmptyStackIndicator(): void {
        // Only show indicator if station has been acquired
        if (!this.isAcquired) {
            return
        }

        const isEmpty = this.burgerDropoff.getItemCount() === 0

        if (isEmpty && !this.emptyBurgerStackIndicator.getIsVisible()) {
            this.emptyBurgerStackIndicator.show()
        } else if (!isEmpty && this.emptyBurgerStackIndicator.getIsVisible()) {
            this.emptyBurgerStackIndicator.hide()
        }

        // Update position if visible
        if (this.emptyBurgerStackIndicator.getIsVisible()) {
            this.emptyBurgerStackIndicator.update(this.emptyBurgerStackIndicatorObject, BurgerShopDirectory.getMainCamera()!)
        }

        const isEmptyShake = this.shakeDropoff.getItemCount() === 0

        if (isEmptyShake && !this.emptyShakeStackIndicator.getIsVisible() && UnlockManager.isAcquired(this.shakeStation)) {
            this.emptyShakeStackIndicator.show()
        } else if ((!isEmptyShake || !UnlockManager.isAcquired(this.shakeStation)) && this.emptyShakeStackIndicator.getIsVisible()) {
            this.emptyShakeStackIndicator.hide()
        }
        
        if (this.emptyShakeStackIndicator.getIsVisible()) {
            this.emptyShakeStackIndicator.update(this.emptyShakeStackIndicatorObject, BurgerShopDirectory.getMainCamera()!)
        }
    }

    /**
     * Create order indicators for both lines
     */
    private createOrderIndicators(): void {
        this.orderIndicator1 = new OrderIndicator({
            burgerCount: 0,
            heightOffset: 3.0,
        })
        this.orderIndicator1.attachTo(this.gameObject, BurgerShopDirectory.getMainCamera()!)
        this.orderIndicator1.hide()

        this.orderIndicator2 = new OrderIndicator({
            burgerCount: 0,
            heightOffset: 3.0,
        })
        this.orderIndicator2.attachTo(this.gameObject, BurgerShopDirectory.getMainCamera()!)
        this.orderIndicator2.hide()
    }

    /**
     * Create deciding indicators for both lines
     */
    private createDecidingIndicators(): void {
        this.decidingIndicator1 = new DecidingIndicator({
            heightOffset: 3.0,
            animationSpeed: 0.5,
        })
        this.decidingIndicator1.attachTo(this.gameObject, BurgerShopDirectory.getMainCamera()!)
        this.decidingIndicator1.hide()

        this.decidingIndicator2 = new DecidingIndicator({
            heightOffset: 3.0,
            animationSpeed: 0.5,
        })
        this.decidingIndicator2.attachTo(this.gameObject, BurgerShopDirectory.getMainCamera()!)
        this.decidingIndicator2.hide()
    }

    /**
     * Update order indicators for both lines
     */
    private currentOrderIndicatorCount1: number = -1
    private currentOrderIndicatorCount2: number = -1

    private updateOrderIndicators(): void {
        this.updateOrderIndicatorForLine(
            this.customerLine1,
            this.orderIndicator1,
            this.decidingIndicator1,
            'currentOrderIndicatorCount1'
        )
    }

    private updateOrderIndicatorForLine(
        line: LineOfCustomers,
        indicator: OrderIndicator,
        decidingIndicator: DecidingIndicator,
        countKey: 'currentOrderIndicatorCount1' | 'currentOrderIndicatorCount2'
    ): void {
        if (line.hasCustomerReachedOrderingPosition()) {
            const frontCustomer = line.getFrontCustomer()
            if (frontCustomer) {
                const customer = frontCustomer.getComponent(SelfCheckoutCustomer)
                if (customer) {
                    const customerState = customer.getState()
                    
                    // Show order indicator only when in ORDERING state
                    if (customerState === SelfCheckoutCustomerState.ORDERING) {
                        decidingIndicator.hide() // Ensure deciding is hidden
                        indicator.show()
                        indicator.updateItemIcon(customer.getItemType())
                        indicator.update(frontCustomer, BurgerShopDirectory.getMainCamera()!)

                        const orderCount = customer.getItemsNeededCount()
                        if (orderCount !== this[countKey]) {
                            this[countKey] = orderCount
                            indicator.updateBurgerCount(orderCount)
                        }
                    } else {
                        indicator.hide()
                    }
                } else {
                    indicator.hide()
                }
            } else {
                indicator.hide()
            }
        } else {
            indicator.hide()
        }
    }

    /**
     * Update deciding indicators for both lines
     */
    private updateDecidingIndicators(deltaTime: number): void {
        this.updateDecidingIndicatorForLine(
            this.customerLine1,
            this.decidingIndicator1,
            this.orderIndicator1,
            deltaTime
        )
    }

    private updateDecidingIndicatorForLine(
        line: LineOfCustomers,
        indicator: DecidingIndicator,
        orderIndicator: OrderIndicator,
        deltaTime: number
    ): void {
        if (line.hasCustomerReachedOrderingPosition()) {
            const frontCustomer = line.getFrontCustomer()
            if (frontCustomer) {
                const customer = frontCustomer.getComponent(SelfCheckoutCustomer)
                if (customer && customer.getState() === SelfCheckoutCustomerState.DECIDING) {
                    orderIndicator.hide() // Ensure order indicator is hidden
                    if (!indicator.getIsVisible()) {
                        indicator.reset()
                        indicator.show()
                    }
                    indicator.update(frontCustomer, BurgerShopDirectory.getMainCamera()!, deltaTime)
                } else {
                    indicator.hide()
                }
            } else {
                indicator.hide()
            }
        } else {
            indicator.hide()
        }
    }

    /**
     * Process burgers in the checkout - serves customers from both lines
     * Prioritizes customer who needs fewer burgers
     */
    private tryCheckoutCustomers(): void {
        // Check if we have burgers to give
        const hasBurgers = this.burgerDropoff.hasItemOfType(Burger.ITEM_TYPE)
        const hasShakes = this.shakeDropoff.hasItemOfType(Shake.ITEM_TYPE)
        if (!hasBurgers && !hasShakes) {
            this.checkoutTimer.reset()
            return
        }

        // Check if timer is still running
        if (this.checkoutTimer.isRunning()) {
            return
        }

        // Get both ordering customers
        const customer1 = this.getOrderingCustomer(this.customerLine1)

        const canServe1 = customer1 ? this.canServeCustomer(customer1) : false

        // Choose which customer to serve (prioritize fewer burgers needed)
        let customerToServe: SelfCheckoutCustomer | null = null

        if (customer1) {
            if (!canServe1) {
                this.checkoutTimer.reset()
                return
            }
            customerToServe = customer1
        }

        // Serve the chosen customer
        if (customerToServe && customerToServe.getItemsNeededCount() > 0) {
            this.giveCustomerItemAndGetMoney(customerToServe)
        }
    }

    private canServeCustomer(customer: SelfCheckoutCustomer): boolean {
        const itemType = customer.getItemType()
        if (itemType === Burger.ITEM_TYPE) {
            return this.burgerDropoff.hasItemOfType(Burger.ITEM_TYPE)
        } else if (itemType === Shake.ITEM_TYPE) {
            return this.shakeDropoff.hasItemOfType(Shake.ITEM_TYPE)
        }
        return false
    }

    private getOrderingCustomer(line: LineOfCustomers): SelfCheckoutCustomer | null {
        if (!line.hasCustomerReachedOrderingPosition()) {
            return null
        }
        const customer = line.getFrontCustomer()?.getComponent(SelfCheckoutCustomer) ?? null
        
        // Only return customer if they're in ORDERING state (not DECIDING)
        if (customer && customer.getState() === SelfCheckoutCustomerState.ORDERING) {
            return customer
        }
        
        return null
    }

    private giveCustomerItemAndGetMoney(customer: SelfCheckoutCustomer): void {
        const itemType = customer.getItemType()

        let item: Item | null = null
        let price: number = 0

        if (itemType === Burger.ITEM_TYPE) {
            item = this.burgerDropoff.removeItem(Burger.ITEM_TYPE)
            price = CostManager.getCost("burger_price")
        } else if (itemType === Shake.ITEM_TYPE) {
            item = this.shakeDropoff.removeItem(Shake.ITEM_TYPE)
            price = CostManager.getCost("shake_price")
        }
        if (!item) {
            return
        }

        // Add money to money pile
        this.moneyPile.addMoney(price)

        // Give burger to the customer
        customer.giveItem(item)

        // Play cash register sound for the sale
        this.audioComponent?.play("cash register")

        // Reset the shared timer
        this.checkoutTimer.reset()
    }

    /**
     * Get the line with fewer customers (for smart customer routing)
     */
    public getShorterLine(): LineOfCustomers {
        return this.customerLine1
    }

    /**
     * Get both customer lines
     */
    public getCustomerLines(): LineOfCustomers {
        return this.customerLine1
    }

    /**
     * Get the current inventory count (number of burgers)
     */
    public getInventoryCount(itemType: string): number {
        if (itemType === Burger.ITEM_TYPE) {
            return this.burgerDropoff.getItemCount()
        } else if (itemType === Shake.ITEM_TYPE) {
            return this.shakeDropoff.getItemCount()
        }
        return 0
    }

    /**
     * Get the delivery position for employees to navigate to
     * Returns the world position of the delivery interaction zone
     */
    public getDeliveryPosition(itemType: string = Burger.ITEM_TYPE): THREE.Vector3 {
        if (itemType === Burger.ITEM_TYPE) {
            return this.burgerDropoff.getInteractionZoneObject().getWorldPosition(new THREE.Vector3())
        } else if (itemType === Shake.ITEM_TYPE) {
            return this.shakeDropoff.getInteractionZoneObject().getWorldPosition(new THREE.Vector3())
        }
        return new THREE.Vector3(0, 0, 0)
    }

    /**
     * Returns the item dropoff zone for the specified item type
     */
    public getItemDropoff(itemType: string): ItemDropoffZone | null {
        if (itemType === Burger.ITEM_TYPE) {
            return this.burgerDropoff
        } else if (itemType === Shake.ITEM_TYPE) {
            return this.shakeDropoff
        }
        return null
    }

    /**
     * Get the number of customers in both lines
     */
    public getCustomersInLineCount(): number {
        return this.customerLine1.getLineLength()
    }

    /**
     * Component cleanup
     */
    protected onCleanup(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Clean up order indicators
        if (this.orderIndicator1) {
            this.orderIndicator1.dispose()
        }
        if (this.orderIndicator2) {
            this.orderIndicator2.dispose()
        }

        // Clean up deciding indicators
        if (this.decidingIndicator1) {
            this.decidingIndicator1.dispose()
        }
        if (this.decidingIndicator2) {
            this.decidingIndicator2.dispose()
        }

        // Clean up empty stack indicator
        if (this.emptyBurgerStackIndicator) {
            this.emptyBurgerStackIndicator.dispose()
        }

        // Remove navigation obstacles for all children with RigidBodyComponents
        this.collisionParent.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component (indicates it has a nav obstacle)
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Remove the navigation obstacle for this GameObject
                DynamicNavSystem.removeObstacleByGameObject(child)
            }
        })

        UnlockManager.removeAcquireListener(this.acquireListener)
    }

    private acquireListener(acquiredItem: UnlockableComponent): void {
        // Only show shake indicator if both self checkout and shake station are acquired
        if (acquiredItem === this.shakeStation && this.isAcquired) {
            this.emptyShakeStackIndicatorObject.setEnabled(true)
            this.emptyShakeStackIndicator.show()
        }
    }
}

