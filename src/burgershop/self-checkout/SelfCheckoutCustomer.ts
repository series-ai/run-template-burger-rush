import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { NavAgent } from "@series-inc/rundot-3d-engine/systems"
import { BurgerCharacterDisplay, BurgerCharacterAnimator } from "../character"
import { SelfCheckoutCustomerSpawner } from "./SelfCheckoutCustomerSpawner"
import { Burger, BurgerShopDirectory } from "@game"
import { SelfCheckoutStation } from "./SelfCheckoutStation"
import { CustomerInventory } from "../customer/CustomerInventory"
import { Item, ItemTypes } from "@game/inventory"
import { LevelingSystem } from "../leveling"
import { 
    LEVEL_SELF_CHECKOUT_ORDER_MIN, 
    LEVEL_SELF_CHECKOUT_ORDER_MAX,
    SELF_CHECKOUT_DECIDING_TIME_MIN,
    SELF_CHECKOUT_DECIDING_TIME_MAX,
} from "../BurgerShopBalanceConfig"
import { Shake } from "@game/shake-station"

export enum SelfCheckoutCustomerState {
    WAITING_TO_CHECKOUT,
    WALKING_TO_FRONT,
    DECIDING,
    ORDERING,
    LEAVING,
}

export class SelfCheckoutCustomer extends Component {
    private state!: SelfCheckoutCustomerState
    private inventory!: CustomerInventory
    private navAgent!: NavAgent

    // Character components
    private displayObject!: GameObject
    private characterDisplay!: BurgerCharacterDisplay
    private characterAnimator!: BurgerCharacterAnimator

    // Spawn position for returning
    private spawnPosition!: THREE.Vector3

    private itemType: string = "burger"

    // Ordering
    private itemOrderCount: number = 1
    private itemsNeededCount: number = 0

    // Deciding phase
    private decidingTimer: number = 0
    private decidingDuration: number = 0

    // Line rotation
    private targetRotation: number = 0
    private readonly ROTATION_SPEED = 2.0 // Radians per second

    constructor() {
        super()
    }

    protected onCreate(): void {
        this.setupCharacterComponents()
        this.setupNavAgent()
        this.setupInventory()
        this.chooseItemType()
    }

    /**
     * Reset this pooled customer for spawning at the given position
     */
    public Spawn(): void {
        this.chooseItemType()
        this.gameObject.setEnabled(true)
        this.spawnPosition = new THREE.Vector3()
        this.gameObject.getWorldPosition(this.spawnPosition)
        // Use level-based order range for self-checkout
        const level = LevelingSystem.getLevel()
        const levelIndex = Math.min(level - 1, LEVEL_SELF_CHECKOUT_ORDER_MIN.length - 1)
        const min = LEVEL_SELF_CHECKOUT_ORDER_MIN[levelIndex]
        const max = LEVEL_SELF_CHECKOUT_ORDER_MAX[levelIndex]
        this.itemOrderCount = Math.floor(Math.random() * (max - min + 1)) + min
        this.itemsNeededCount = this.itemOrderCount

        // Reset deciding timer and set random duration
        this.decidingTimer = 0
        this.decidingDuration = SELF_CHECKOUT_DECIDING_TIME_MIN + Math.random() * (SELF_CHECKOUT_DECIDING_TIME_MAX - SELF_CHECKOUT_DECIDING_TIME_MIN)

        if (this.navAgent) {
            this.navAgent.stop()
        }

        this.state = SelfCheckoutCustomerState.WAITING_TO_CHECKOUT
        this.joinSelfCheckoutLine()
    }

    public Despawn(): void {
        // Clear inventory and destroy burgers
        this.clearInventory()
        
        this.gameObject.setEnabled(false)
        SelfCheckoutCustomerSpawner.ReturnToPool(this)
    }

    public update(deltaTime: number): void {
        this.updateAnimations()

        // Smoothly rotate towards target rotation when in line
        if (this.state === SelfCheckoutCustomerState.WAITING_TO_CHECKOUT || 
            this.state === SelfCheckoutCustomerState.WALKING_TO_FRONT ||
            this.state === SelfCheckoutCustomerState.DECIDING ||
            this.state === SelfCheckoutCustomerState.ORDERING) {
            this.updateLineRotation(deltaTime)
        }

        switch (this.state) {
            case SelfCheckoutCustomerState.WALKING_TO_FRONT:
                // Wait until customer actually reaches the front position
                if (this.navAgent.hasReachedTarget()) {
                    this.state = SelfCheckoutCustomerState.DECIDING
                    this.decidingTimer = 0
                }
                break
            case SelfCheckoutCustomerState.DECIDING:
                // Update deciding timer
                this.decidingTimer += deltaTime
                if (this.decidingTimer >= this.decidingDuration) {
                    this.state = SelfCheckoutCustomerState.ORDERING
                    this.decidingTimer = 0 // Reset for clarity
                }
                break
            case SelfCheckoutCustomerState.ORDERING:
                // Check if we have all our burgers
                if (this.itemsNeededCount <= 0) {
                    this.startLeaving()
                }
                break
            case SelfCheckoutCustomerState.LEAVING:
                if (this.navAgent.hasReachedTarget()) {
                    this.Despawn()
                }
                break
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
            "stowkit://Character_F_DressCardigan_Blue",
            "stowkit://Character_F_DressCardigan_Green",
            "stowkit://Character_F_DressCardigan_Pink",
            "stowkit://Character_M_SuitCasual50s_Brown",
            "stowkit://Character_M_SuitCasual50s_Navy",
            "stowkit://Character_M_SuitCasual50s_Tan",
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

    private chooseItemType(): void {
        const shakeCheckoutStations = BurgerShopDirectory.getActiveBurgerStations().filter((station) => station.getInventory().hasItemOfType(ItemTypes.SHAKE))

        if (shakeCheckoutStations.length > 0) {
            this.itemType = Math.random() < 0.5 ? ItemTypes.BURGER : ItemTypes.SHAKE
        } else {
            this.itemType = ItemTypes.BURGER
        }
    }

    /**
     * Update animations based on customer state and movement
     */
    private updateAnimations(): void {
        if (!this.characterAnimator) return

        // Get normalized movement speed (0-1) for smooth animation blending
        const movementSpeed = this.navAgent ? this.navAgent.getMovementSpeedNormalized() : 0.0

        // Determine if customer is carrying food (has items in inventory)
        const isCarrying = this.inventory && this.inventory.getItemCount() > 0

        // Update animation parameters
        this.characterAnimator.setMovementSpeed(movementSpeed)
        this.characterAnimator.setCarrying(isCarrying)
        this.characterAnimator.setEating(false)
        this.characterAnimator.setWaitingForCashier(this.state === SelfCheckoutCustomerState.WAITING_TO_CHECKOUT)
        this.characterAnimator.setInteractingKiosk(this.state === SelfCheckoutCustomerState.DECIDING)
    }

    /**
     * Give food to this customer
     */
    public giveItem(item: Item): void {
        this.inventory.addItemAnimated(item)
        this.itemsNeededCount--

        if (this.itemsNeededCount <= 0) {
            this.itemsNeededCount = 0
        }
    }

    public getItemType(): string {
        return this.itemType
    }

    /**
     * Clear inventory and destroy all items (burgers)
     */
    private clearInventory(): void {
        if (!this.inventory) return

        // Remove and destroy all items
        const items = this.inventory.getAllItems()
        for (const item of items) {
            this.inventory.removeItem()
            item.getGameObject().dispose()
        }
    }

    private onLinePositionChanged(lineIndex: number, worldPosition: THREE.Vector3, forwardDirection: THREE.Vector3): void {
        this.navAgent.moveTo(worldPosition)

        // Calculate target rotation from forward direction (flip 180 degrees to face forward)
        if (forwardDirection.length() > 0.001) {
            this.targetRotation = Math.atan2(forwardDirection.x, forwardDirection.z) + Math.PI
        }

        if (lineIndex === 0) {
            this.state = SelfCheckoutCustomerState.WALKING_TO_FRONT
        }
    }

    private startLeaving(): void {
        // Leave the line so the next customer can move up
        this.leaveSelfCheckoutLine()
        
        this.navAgent.moveTo(this.spawnPosition)
        this.state = SelfCheckoutCustomerState.LEAVING
    }

    /**
     * Join the self-checkout line (chooses the shorter line)
     */
    private joinSelfCheckoutLine(): void {
        const selfCheckoutStation = this.getSelfCheckoutStation()
        if (selfCheckoutStation) {
            const customerLine = selfCheckoutStation.getShorterLine()
            customerLine.addToLine(this.gameObject, this.onLinePositionChanged.bind(this))
        }
    }

    /**
     * Leave the self-checkout line
     */
    private leaveSelfCheckoutLine(): void {
        const selfCheckoutStation = this.getSelfCheckoutStation()
        if (selfCheckoutStation) {
            // We need to know which line we're in, so we'll try both
            const customerLine = selfCheckoutStation.getCustomerLines()
            customerLine.removeFromLine(this.gameObject)
        }
    }

    /**
     * Get the self-checkout station (for now, assumes there's only one)
     */
    private getSelfCheckoutStation(): SelfCheckoutStation | null {
        const selfCheckoutStations = BurgerShopDirectory.getActiveSelfCheckoutStations()
        return selfCheckoutStations.length > 0 ? selfCheckoutStations[0] : null
    }

    /**
     * Get current state
     */
    public getState(): SelfCheckoutCustomerState {
        return this.state
    }

    /**
     * Get the number of burgers this customer has ordered
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
}

