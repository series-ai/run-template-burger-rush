import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { NavAgent } from "@series-inc/rundot-3d-engine/systems"
import { BurgerShopDirectory, CustomerSpawner, Item, Table, ItemTypes } from "@game"
import { CustomerInventory } from "./CustomerInventory"
import { BurgerCharacterDisplay, BurgerCharacterAnimator } from "../character"
import { CustomerConfig } from "./CustomerConfig"
import { BathroomStall, BathroomStallState } from "@game/bathroom-station/BathroomStall"
import { BathroomStation } from "@game/bathroom-station/BathroomStation"
import { 
    EATING_TIME_MIN, 
    EATING_TIME_MAX, 
    ORDER_TIME,
    LEVEL_CHECKOUT_ORDER_MIN,
    LEVEL_CHECKOUT_ORDER_MAX,
    LEVEL_SHAKE_CHECKOUT_ORDER_MIN,
    LEVEL_SHAKE_CHECKOUT_ORDER_MAX,
    USING_BATHROOM_TIME_MIN,
    USING_BATHROOM_TIME_MAX,
    BATHROOM_USE_CHANCE,
} from "../BurgerShopBalanceConfig"
import { LevelingSystem } from "../leveling"

export enum CustomerState {
    WAITING_TO_ORDER,
    ORDERING,
    HEADING_TO_TABLE,
    EATING,
    LEAVING,
    HEADING_TO_BATHROOM,
    WAITING_FOR_BATHROOM,
    USING_BATHROOM,
}

export class Customer extends Component {
    private state!: CustomerState
    private inventory!: CustomerInventory
    private navAgent!: NavAgent

    // Character components
    private displayObject!: GameObject
    private characterDisplay!: BurgerCharacterDisplay
    private characterAnimator!: BurgerCharacterAnimator

    // Timing
    private stateTimer: number = 0

    // Table assignment
    private assignedTable: Table | null = null
    private assignedChair: GameObject | null = null // Which chair at the table

    // Bathroom assignment
    private assignedBathroomStall: BathroomStall | null = null
    private assignedBathroomStation: BathroomStation | null = null

    // Spawn position for returning
    private spawnPosition!: THREE.Vector3

    // Ordering
    private desiredItemType: string = "burger"
    private itemOrderCount: number = 1
    private itemsNeededCount: number = 0

    // Line rotation
    private targetRotation: number = 0
    private readonly ROTATION_SPEED = 2.0 // Radians per second

    // Spawner reference (for returning to correct pool)
    private spawner: any = null

    // Reusable temp vectors to avoid per-frame allocations
    private readonly _tempCustomerPos = new THREE.Vector3()
    private readonly _tempTablePosA = new THREE.Vector3()
    private readonly _tempTablePosB = new THREE.Vector3()
    private readonly _tempChairPos = new THREE.Vector3()
    private readonly _tempSeatingPos = new THREE.Vector3()
    private readonly _tempSeatingLocal = new THREE.Vector3()
    private readonly _tempTablePos = new THREE.Vector3()
    private readonly _tempTableLocal = new THREE.Vector3()
    private readonly _tempDirection = new THREE.Vector3()
    private readonly _tempWorldDir = new THREE.Vector3()
    private readonly _tempLookPos = new THREE.Vector3()
    private readonly _tempLookLocal = new THREE.Vector3()
    private readonly _tempStallPos = new THREE.Vector3()

    /**
     * Reset this pooled customer for spawning at the given position
     */
    public Spawn(itemType: string): void {
        this.gameObject.setEnabled(true)
        this.spawnPosition = new THREE.Vector3()
        this.gameObject.getWorldPosition(this.spawnPosition)
        
        // Set desired item type and generate order count based on level
        this.desiredItemType = itemType
        this.itemOrderCount = this.getOrderCountForLevel(itemType)
        this.itemsNeededCount = this.itemOrderCount

        if (this.navAgent) {
            this.navAgent.stop()
        }

        this.state = CustomerState.WAITING_TO_ORDER
        this.joinCheckoutLine()
    }

    public Despawn(): void {
        this.gameObject.setEnabled(false)
        if (this.spawner) {
            this.spawner.returnToPool(this)
        }
    }

    /**
     * Set the spawner that created this customer (for pool management)
     */
    public setSpawner(spawner: any): void {
        this.spawner = spawner
    }

    /**
     * Get order count based on current level and item type
     */
    private getOrderCountForLevel(itemType: string): number {
        const level = LevelingSystem.getLevel()
        
        if (itemType === ItemTypes.BURGER) {
            const levelIndex = Math.min(level - 1, LEVEL_CHECKOUT_ORDER_MIN.length - 1)
            const min = LEVEL_CHECKOUT_ORDER_MIN[levelIndex]
            const max = LEVEL_CHECKOUT_ORDER_MAX[levelIndex]
            return Math.floor(Math.random() * (max - min + 1)) + min
        }
        
        if (itemType === ItemTypes.SHAKE) {
            const levelIndex = Math.min(level - 1, LEVEL_SHAKE_CHECKOUT_ORDER_MIN.length - 1)
            const min = LEVEL_SHAKE_CHECKOUT_ORDER_MIN[levelIndex]
            const max = LEVEL_SHAKE_CHECKOUT_ORDER_MAX[levelIndex]
            return Math.floor(Math.random() * (max - min + 1)) + min
        }
        
        // Fall back to CustomerConfig for other item types
        return CustomerConfig.getOrderCountForItemType(itemType)
    }

    constructor() {
        super()
    }

    protected onCreate(): void {
        this.setupCharacterComponents()
        this.setupNavAgent()
        this.setupInventory()
    }

    /**
     * Give food to this customer - handles table assignment and state changes
     */
    public giveItem(item: Item): void {
        this.inventory.addItemAnimated(item)
        this.itemsNeededCount--

        if (this.itemsNeededCount <= 0) {
            this.itemsNeededCount = 0
        }
    }

    private findCleanTable(): Table | null {
        const activeTables = BurgerShopDirectory.getActiveTables()
        
        // Get customer position for distance calculations (reuse temp vector)
        this.gameObject.getWorldPosition(this._tempCustomerPos)
        
        // Find closest valid table without sorting (O(n) instead of O(n log n))
        // This avoids creating Vector3 objects in sort callbacks
        let closestTable: Table | null = null
        let closestDistance = Infinity
        
        for (const table of activeTables) {
            // Check if table is available
            if (!table.isAvailable()) {
                continue
            }
            
            // Check if table has customers with different item types
            const tableItemTypes = table.getCustomerItemTypes()
            
            // Only allow empty tables or tables with matching item type only
            const isValid = tableItemTypes.size === 0 || 
                (tableItemTypes.has(this.desiredItemType) && tableItemTypes.size === 1)
            
            if (!isValid) {
                continue
            }
            
            // Calculate distance using reusable vector
            table.getGameObject().getWorldPosition(this._tempTablePosA)
            const dist = this._tempCustomerPos.distanceToSquared(this._tempTablePosA)
            
            if (dist < closestDistance) {
                closestDistance = dist
                closestTable = table
            }
        }
        
        return closestTable
    }

    public update(deltaTime: number): void {
        this.updateAnimations()

        // Smoothly rotate towards target rotation when in line
        if (this.state === CustomerState.WAITING_TO_ORDER || 
            this.state === CustomerState.ORDERING ||
            this.state === CustomerState.WAITING_FOR_BATHROOM) {
            this.updateLineRotation(deltaTime)
        }

        this.stateTimer -= deltaTime
        switch (this.state) {
            case CustomerState.ORDERING:
                this.orderingStateUpdate()
                break
            case CustomerState.HEADING_TO_TABLE:
                if (this.navAgent.hasReachedTarget()) {
                    this.startEating()
                }
                break
            case CustomerState.EATING:
                if (this.assignedTable?.hasFood()) {
                    if (this.assignedTable?.TableIsFullOfEatingCustomers()) {
                        this.eatingWithOthers(deltaTime)
                    }
                    else {
                        this.eatingAlone(deltaTime)
                    }
                }
                else {
                    this.finishEating()

                    if (!this.tryHeadingToBathroom()) {
                        this.startLeaving()
                    }
                }
                break
            case CustomerState.HEADING_TO_BATHROOM:
                if (this.navAgent.hasReachedTarget()) {
                    if (this.assignedBathroomStall === null) {
                        this.state = CustomerState.WAITING_FOR_BATHROOM
                    }
                    else {
                        this.startUsingBathroom()
                    }
                }
                break
            case CustomerState.WAITING_FOR_BATHROOM:
                this.waitingForBathroomStateUpdate()
                break
            case CustomerState.USING_BATHROOM:
                this.usingBathroomStateUpdate()
                break
            case CustomerState.LEAVING:
                if (this.navAgent.hasReachedTarget()) {
                    this.Despawn()
                }
                break
        }
    }

    private orderingStateUpdate() {
        if (this.itemsNeededCount > 0) {
            return
        }

        const table = this.findCleanTable()
        if (!table) {
            return
        }

        this.leaveCheckoutLine()

        this.assignedTable = table
        this.assignedChair = table.assignCustomerAndGetChair(this)
        this.assignedChair!.getWorldPosition(this._tempChairPos)
        this.navAgent.moveTo(this._tempChairPos)
        this.state = CustomerState.HEADING_TO_TABLE

        const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
        tutorialSystem?.getTracker().recordCustomerServed()
    }

    private tryHeadingToBathroom(): boolean {
        const availableBathroomStation = BurgerShopDirectory.findAvailableBathroomStation()
        if (!availableBathroomStation) {
            return false
        }

        if (Math.random() > BATHROOM_USE_CHANCE) {
            return false
        }

        this.assignedBathroomStation = availableBathroomStation
        this.assignedBathroomStall = availableBathroomStation.findAvailableStall()

        if (!this.assignedBathroomStall || this.assignedBathroomStation.getCustomerLine().getLineLength() > 0) {
            // Join line
            this.joinBathroomLine()
            return true
        }
        this.assignedBathroomStall.assignCustomer(this)

        this.assignedBathroomStall.getStallParent().getWorldPosition(this._tempStallPos)
        this.navAgent.moveTo(this._tempStallPos)
        this.state = CustomerState.HEADING_TO_BATHROOM

        return true
    }

    private waitingForBathroomStateUpdate() {
        if (this.assignedBathroomStation === null) {
            this.startLeaving()
            return
        }

        const frontCustomer = this.assignedBathroomStation?.getCustomerLine()?.getFrontCustomer()

        if (frontCustomer !== this.gameObject) {
            return
        }

        let availableStall = this.assignedBathroomStation?.findAvailableStall()
        
        if (!availableStall) {
            return
        }

        this.leaveBathroomLine()

        this.assignedBathroomStall = availableStall
        availableStall.assignCustomer(this)
        availableStall.getStallParent().getWorldPosition(this._tempStallPos)
        this.navAgent.moveTo(this._tempStallPos)

        this.state = CustomerState.HEADING_TO_BATHROOM
    }

    private startUsingBathroom(): void {
        if (!this.assignedBathroomStall) {
            console.warn(`No bathroom stall found`)
            this.startLeaving()
            return
        }
        this.assignedBathroomStall.setState(BathroomStallState.InUse)
        this.state = CustomerState.USING_BATHROOM
        this.stateTimer = USING_BATHROOM_TIME_MIN + Math.floor(Math.random() * (USING_BATHROOM_TIME_MAX - USING_BATHROOM_TIME_MIN))

        this.navAgent.stop()
        this.snapToBathroomStallPosAndFaceStall()
    }

    private usingBathroomStateUpdate() {
        if (this.stateTimer <= 0) {
            this.assignedBathroomStall?.customerFinished()
            this.assignedBathroomStall = null
            this.assignedBathroomStation = null
            this.resetCharacterDisplayPosition()
            this.startLeaving()
        }
    }

    /**
     * Smoothly rotate towards the target rotation when standing in line
     */
    private updateLineRotation(deltaTime: number): void {
        const currentRotation = this.gameObject.rotation.y

        // Calculate shortest angular distance
        let angleDiff = this.targetRotation - currentRotation

        // Normalize to [-PI, PI] range
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

        // Smoothly interpolate rotation
        const rotationStep = this.ROTATION_SPEED * deltaTime
        if (Math.abs(angleDiff) < rotationStep) {
            this.gameObject.rotation.y = this.targetRotation
        } else {
            this.gameObject.rotation.y += Math.sign(angleDiff) * rotationStep
        }
    }

    private setupCharacterComponents(): void {
        this.displayObject = new GameObject()
        this.getGameObject().add(this.displayObject)
        this.displayObject.position.set(0, 0, 0)

        // Randomly pick between customer models
        const customerModels = [
            "stowkit://character_f_dresscardigan_blue",
            "stowkit://character_f_dresscardigan_green",
            "stowkit://character_f_dresscardigan_pink",
            "stowkit://character_m_suitcasual50_brown",
            "stowkit://character_m_suitcasual50_navy",
            "stowkit://character_m_suitcasual50_tan",
        ]
        const randomModel = customerModels[Math.floor(Math.random() * customerModels.length)]
        this.characterDisplay = new BurgerCharacterDisplay(randomModel)
        this.displayObject.addComponent(this.characterDisplay)

        this.characterAnimator = new BurgerCharacterAnimator()
        this.displayObject.addComponent(this.characterAnimator)
    }

    private setupNavAgent(): void {
        this.navAgent = new NavAgent()
        this.navAgent.moveSpeed = 3.6
        this.navAgent.arrivalDistance = 0.2
        this.gameObject.addComponent(this.navAgent)
    }

    private setupInventory(): void {
        this.inventory = new CustomerInventory()
        this.gameObject.addComponent(this.inventory)
    }


    public isEating(): boolean {
        return this.state === CustomerState.EATING;
    }

    /**
     * Update animations based on customer state and movement
     */
    private updateAnimations(): void {
        if (!this.characterAnimator) return

        // Get normalized movement speed (0-1) for smooth animation blending
        const movementSpeed = this.navAgent ? this.navAgent.getMovementSpeedNormalized() : 0.0

        // Determine if customer is eating (when in EATING_FOOD state)
        const isEating = this.isEating()

        // Determine if customer is carrying food (has items in inventory)
        const isCarrying = this.inventory && this.inventory.getItemCount() > 0

        // Update animation parameters using clean API
        this.characterAnimator.setMovementSpeed(movementSpeed) // Smooth blend between idle and walk
        this.characterAnimator.setCarrying(isCarrying) // Show carrying animations when has food
        this.characterAnimator.setEating(isEating)
        this.characterAnimator.setUsingBathroom(this.state === CustomerState.USING_BATHROOM)
        this.characterAnimator.setWaitingForBathroom(this.state === CustomerState.WAITING_FOR_BATHROOM)
        this.characterAnimator.setWaitingForCashier(this.state === CustomerState.WAITING_TO_ORDER)
    }

    private onLinePositionChanged(lineIndex: number, worldPosition: THREE.Vector3, forwardDirection: THREE.Vector3): void {
        this.navAgent.moveTo(worldPosition)

        // Calculate target rotation from forward direction (flip 180 degrees to face forward)
        if (forwardDirection.length() > 0.001) {
            this.targetRotation = Math.atan2(forwardDirection.x, forwardDirection.z) + Math.PI
        }

        if (lineIndex === 0 && this.state === CustomerState.WAITING_TO_ORDER) {
            this.state = CustomerState.ORDERING
            this.stateTimer = ORDER_TIME
        }
    }

    private startLeaving(): void {
        this.navAgent.moveTo(this.spawnPosition)
        this.state = CustomerState.LEAVING
    }

    /**
     * Snap customer to exact chair position for perfect seating alignment
     * Moves only the visual character display, leaving GameObject position unchanged for NavAgent
     */
    private snapToChairPosAndFaceTable(): void {
        // Calculate seating position at chair (using temp vectors)
        this.assignedChair?.getWorldPosition(this._tempSeatingPos)
        this._tempSeatingLocal.copy(this._tempSeatingPos)
        this.displayObject.worldToLocal(this._tempSeatingLocal)

        // Calculate table position for rotation
        this.assignedTable?.getGameObject().getWorldPosition(this._tempTablePos)
        this._tempTableLocal.copy(this._tempTablePos)
        this.displayObject.worldToLocal(this._tempTableLocal)

        // Calculate direction to table
        this._tempDirection.copy(this._tempTableLocal).sub(this._tempSeatingLocal).normalize()

        // Position the display object (move forward toward table)
        this._tempSeatingLocal.addScaledVector(this._tempDirection, 0.35)
        this.displayObject.position.set(
            this._tempSeatingLocal.x,
            this._tempSeatingLocal.y + 0.9,
            this._tempSeatingLocal.z)

        // Calculate rotation manually to avoid lookAt flipping issues
        this._tempWorldDir.copy(this._tempTablePos).sub(this._tempSeatingPos)
        this._tempWorldDir.y = 0 // Keep rotation only on Y-axis
        this._tempWorldDir.normalize()

        // Calculate rotation (atan2 gives us the angle to face the direction)
        const rotationY = Math.atan2(this._tempWorldDir.x, this._tempWorldDir.z)

        // Set rotation with clean XYZ values (no flipping)
        this.displayObject.rotation.set(0, rotationY, 0)
    }

    private snapToBathroomStallPosAndFaceStall(): void {
        // Calculate seating position (using temp vectors)
        this.assignedBathroomStall?.getSeatPivot().getWorldPosition(this._tempSeatingPos)
        this._tempSeatingLocal.copy(this._tempSeatingPos)
        this.displayObject.worldToLocal(this._tempSeatingLocal)

        // Calculate look position for rotation
        this.assignedBathroomStall?.getEmployeeTarget().getWorldPosition(this._tempLookPos)
        this._tempLookLocal.copy(this._tempLookPos)
        this.displayObject.worldToLocal(this._tempLookLocal)

        // Calculate look direction
        this._tempDirection.copy(this._tempLookLocal).sub(this._tempSeatingLocal).normalize()

        // Position the display object (move forward toward look target)
        this._tempSeatingLocal.addScaledVector(this._tempDirection, 0.35)
        this.displayObject.position.set(
            this._tempSeatingLocal.x,
            this._tempSeatingLocal.y,
            this._tempSeatingLocal.z)

        // Calculate rotation manually to avoid lookAt flipping issues
        this._tempWorldDir.copy(this._tempLookPos).sub(this._tempSeatingPos)
        this._tempWorldDir.y = 0 // Keep rotation only on Y-axis
        this._tempWorldDir.normalize()

        // Calculate rotation (atan2 gives us the angle to face the direction)
        const rotationY = Math.atan2(this._tempWorldDir.x, this._tempWorldDir.z)

        // Set rotation with clean XYZ values (no flipping)
        //this.displayObject.rotation.set(0, rotationY, 0)
    }

    /**
     * Reset character display position back to normal when leaving table
     */
    private resetCharacterDisplayPosition(): void {
        // Reset display object to normal position relative to main GameObject
        this.displayObject.position.set(0, 0, 0)
        this.displayObject.rotation.set(0, 0, 0)
    }

    /**
     * Join the checkout line for the desired item type
     */
    private joinCheckoutLine(): void {
        const checkoutStation = BurgerShopDirectory.getCheckoutStationByItemType(this.desiredItemType)
        if (!checkoutStation) {
            console.warn(`No checkout station found for item type: ${this.desiredItemType}`)
            return
        }
        const customerLine = checkoutStation.getCustomerLine()
        customerLine.addToLine(this.gameObject, this.onLinePositionChanged.bind(this))
    }

    /**
     * Leave the checkout line
     */
    private leaveCheckoutLine(): void {
        const checkoutStation = BurgerShopDirectory.getCheckoutStationByItemType(this.desiredItemType)
        if (!checkoutStation) {
            console.warn(`No checkout station found for item type: ${this.desiredItemType}`)
            return
        }
        const customerLine = checkoutStation.getCustomerLine()
        customerLine.removeFromLine(this.gameObject)
    }

    /**
     * Join the checkout line for the desired item type
     */
    private joinBathroomLine(): void {
        if (!this.assignedBathroomStation) {
            console.warn(`No bathroom station found`)
            return
        }
        const customerLine = this.assignedBathroomStation.getCustomerLine()
        customerLine.addToLine(this.gameObject, this.onLinePositionChanged.bind(this))

        this.state = CustomerState.WAITING_FOR_BATHROOM
    }

    /**
     * Leave the checkout line
     */
    private leaveBathroomLine(): void {
        if (!this.assignedBathroomStation) {
            console.warn(`No bathroom station found`)
            return
        }
        const customerLine = this.assignedBathroomStation.getCustomerLine()
        customerLine.removeFromLine(this.gameObject)
    }

    /**
     * Get current state
     */
    public getState(): CustomerState {
        return this.state
    }

    /**
     * Get the desired item type for this customer
     */
    public getDesiredItemType(): string {
        return this.desiredItemType
    }

    /**
     * Get the number of items this customer has ordered
     */
    public getItemsNeededCount(): number {
        return this.itemsNeededCount
    }

    /**
     * Get customer inventory
     */
    public getInventory(): CustomerInventory {
        return this.inventory
    }

    /**
     * Transfer food items from customer inventory to table display
     */
    private transferFoodToTable(): void {
        const itemCount = this.inventory.getItemCount()
        for (let i = 0; i < itemCount; i++) {
            const item = this.inventory.removeItem()!
            this.assignedTable!.AddItemToFoodInventory(item)
        }
    }


    private eatingTimer: number = 0
    private readonly eatingDelay : number = EATING_TIME_MAX
    private readonly eatingFullTableDelay : number = EATING_TIME_MIN

    private startEating(): void {
        this.navAgent.stop()
        this.transferFoodToTable()
        this.snapToChairPosAndFaceTable()
        if (this.assignedTable?.TableIsFullOfEatingCustomers()) {
            this.state = CustomerState.EATING
            this.eatingTimer = this.eatingFullTableDelay
        }
        else {
            this.state = CustomerState.EATING
            this.eatingTimer = this.eatingDelay
        }
    }

    private eatingAlone(deltaTime: number): void {
        this.eatingTimer -= deltaTime
        
        if (this.assignedTable!.areCustomersHeadingToTable() && this.assignedTable!.getFoodCount() <= 1) {
            return // Wait for other customers to arrive with more food
        }

        if (this.eatingTimer <= 0) {
            this.assignedTable!.removeFoodItems(1);
            this.eatingTimer = this.eatingDelay;
        }
    }

    private eatingWithOthers(deltaTime: number): void {
        this.eatingTimer -= deltaTime
        if (this.eatingTimer <= 0) {
            this.assignedTable!.removeFoodItems(1);
            this.eatingTimer = this.eatingFullTableDelay;
        }
    }



    /**
     * Finish eating - table will generate trash when last customer leaves
     */
    private finishEating(): void {
        this.resetCharacterDisplayPosition()
        this.assignedTable!.removeFoodItems(this.itemOrderCount)
        this.assignedTable!.customerFinishedEating(this)
    }
}
