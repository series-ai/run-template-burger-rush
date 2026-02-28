import * as THREE from "three"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { NavAgent, Audio2D } from "@series-inc/rundot-3d-engine/systems"
import { BurgerCharacterDisplay, BurgerCharacterAnimator } from "../character"
import { Burger, BurgerShopDirectory, CostManager, MoneySystem, PlayerComponent, TargetPointer } from "@game"
import { CustomerInventory } from "../customer/CustomerInventory"
import { Item, ItemTypes, HasInventory } from "@game/inventory"
import { LevelingSystem } from "../leveling"
import { LEVEL_VIP_ORDER_MIN, LEVEL_VIP_ORDER_MAX, VIP_LIFESPAN_PER_ORDER_COUNT, VIP_REWARD_VALUE_MULTIPLIER } from "../BurgerShopBalanceConfig"
import { Shake } from "@game/shake-station"
import { VIPCustomerSpawner } from "./VIPCustomerSpawner"
import { Timer } from "@game/Timer"
import { VIPOrderIndicator } from "./VIPOrderIndicator"

export enum VIPCustomerState {
    WALKING_TO_TARGET,
    ORDERING,
    LEAVING,
}

export class VIPCustomer extends Component {
    private state!: VIPCustomerState
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
    private orderCounts: Record<string, number> = {}
    private itemOrderCount: number = 1
    private itemsNeededCount: number = 0
    private orderWaitTimer!: Timer
    private vipOrderIndicator!: VIPOrderIndicator
    private orderValue: number = 0

    private uiCamera: THREE.Camera | null = null

    // Pseudo dropoff zone
    private readonly COLLECTION_INTERVAL = 0.08
    private collectionTimer: Timer
    private interactionZone: InteractionZone | null = null
    private interactionZoneObject: GameObject | null = null
    private playersInZone: Set<GameObject> = new Set()
    private audioComponent: Audio2D | null = null

    // Target pointer system
    private targetPointerObject: GameObject | null = null
    private targetPointer: TargetPointer | null = null

    constructor() {
        super()
        this.collectionTimer = new Timer(this.COLLECTION_INTERVAL)
    }

    protected onCreate(): void {
        this.setupCharacterComponents()
        this.setupNavAgent()
        this.setupInventory()
        this.setupAudio()

        this.vipOrderIndicator = new VIPOrderIndicator({
            heightOffset: 3.25,
            orderCounts: this.orderCounts,
            orderTime: VIP_LIFESPAN_PER_ORDER_COUNT * this.itemOrderCount,
        })
        this.uiCamera = BurgerShopDirectory.getMainCamera()
        if (this.uiCamera) {
            this.vipOrderIndicator.attachTo(this.gameObject, this.uiCamera)
        }

        this.createTargetPointer()
    }

    /**
     * Reset this pooled customer for spawning at the given position
     */
    public Spawn(orderPosition: THREE.Vector3): void {
        this.gameObject.setEnabled(true)
        this.spawnPosition = new THREE.Vector3()
        this.gameObject.getWorldPosition(this.spawnPosition)

        // Use level-based order range
        const level = LevelingSystem.getLevel()
        const levelIndex = Math.min(level - 1, LEVEL_VIP_ORDER_MIN.length - 1)
        const min = LEVEL_VIP_ORDER_MIN[levelIndex]
        const max = LEVEL_VIP_ORDER_MAX[levelIndex]
        this.itemOrderCount = Math.floor(Math.random() * (max - min + 1)) + min
        this.itemsNeededCount = this.itemOrderCount
        this.chooseOrder()

        this.orderWaitTimer = new Timer(VIP_LIFESPAN_PER_ORDER_COUNT * this.itemOrderCount)

        // Reset dropoff zone
        this.playersInZone.clear()
        this.collectionTimer.reset()

        if (this.navAgent) {
            this.navAgent.stop()
        }

        this.state = VIPCustomerState.WALKING_TO_TARGET
        this.navAgent.moveTo(orderPosition)

        //this.interactionZone.setActive(true)

        this.hideIndicators()
    }

    public Despawn(): void {
        // Clear inventory and destroy burgers
        this.clearInventory()

        // Clear dropoff zone
        this.playersInZone.clear()
        //this.interactionZone.setActive(false)

        this.gameObject.setEnabled(false)
        VIPCustomerSpawner.ReturnToPool(this)
    }

    public update(deltaTime: number): void {
        this.updateAnimations()

        if (this.vipOrderIndicator.getIsVisible()) {
            this.vipOrderIndicator.update(this.gameObject, this.uiCamera!, deltaTime)
        }

        switch (this.state) {
            case VIPCustomerState.WALKING_TO_TARGET:
                if (this.navAgent.hasReachedTarget()) {
                    this.state = VIPCustomerState.ORDERING
                    this.gameObject.rotation.set(0, Math.PI, 0)

                    this.setupDropoffZone()

                    this.vipOrderIndicator.reset(this.orderCounts, this.orderWaitTimer.duration)
                    this.showIndicators()
                }
                break
            case VIPCustomerState.ORDERING:
                this.orderWaitTimer.tick(deltaTime)

                this.tryCollectFromEntities(deltaTime)

                if (this.itemsNeededCount <= 0) {
                    MoneySystem.OneOffReward(this.orderValue * VIP_REWARD_VALUE_MULTIPLIER)
                    this.startLeaving()
                }
                else if (this.orderWaitTimer.isDone()) {
                    this.startLeaving()
                }
                break
            case VIPCustomerState.LEAVING:
                if (this.navAgent.hasReachedTarget()) {
                    this.Despawn()
                }
                break
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

    /**
     * Setup the pseudo dropoff zone for collecting items from employees
     */
    private setupDropoffZone(): void {
        this.interactionZoneObject = new GameObject("VIPCustomerDropoffZone")
        this.gameObject.add(this.interactionZoneObject)
        this.interactionZoneObject.position.set(0, 0, 0) // Position relative to customer

        this.interactionZone = new InteractionZone(
            (entity: GameObject) => this.onEntityEnter(entity),
            (entity: GameObject) => this.onEntityExit(entity),
            {
                width: 6,  // Zone size around customer
                depth: 6,
                active: true,
                show: false,
            }
        )
        this.interactionZoneObject.addComponent(this.interactionZone)
    }
  
    /**
     * Create the target pointer for tutorial steps
     */
    private createTargetPointer(): void {
        this.targetPointerObject = new GameObject("TutorialTargetPointer")
        this.gameObject.add(this.targetPointerObject)

        this.targetPointer = new TargetPointer()
        this.targetPointerObject.addComponent(this.targetPointer)
        this.targetPointer.setWorldArrowEnabled(false)

        if (this.uiCamera) {
            this.targetPointer.setCamera(this.uiCamera)
        }
    }

    private cleanupDropoffZone(): void {
        if (this.interactionZoneObject) {
            this.interactionZoneObject.dispose()
            this.interactionZoneObject = null
        }
    }

    /**
     * Setup audio component for item collection
     */
    private setupAudio(): void {
        const audioClipName = "place burgers"
        this.audioComponent = new Audio2D([audioClipName])
        this.gameObject.addComponent(this.audioComponent)
    }

    /**
     * Handle entity entering the dropoff zone
     */
    private onEntityEnter(entity: GameObject): void {
        const playerComponent = entity.getComponent(PlayerComponent)
        if (playerComponent) {
            this.playersInZone.add(entity)
        }
    }

    /**
     * Handle entity exiting the dropoff zone
     */
    private onEntityExit(entity: GameObject): void {
        const playerComponent = entity.getComponent(PlayerComponent)
        if (playerComponent) {
            this.playersInZone.delete(entity)
        }
    }

    private chooseOrder(): void {
        // Reset order counts
        this.orderCounts = {}
        this.orderValue = 0

        const shakeCheckoutStations = BurgerShopDirectory.getActiveBurgerStations().filter((station) => station.getInventory().hasItemOfType(ItemTypes.SHAKE))

        if (shakeCheckoutStations.length > 0) {
            let orderCount = this.itemOrderCount
            while (orderCount > 0) {
                const itemType = Math.random() < 0.5 ? ItemTypes.BURGER : ItemTypes.SHAKE
                const cost = CostManager.getCost(itemType + "_price")
                this.orderValue += cost
                this.orderCounts[itemType] = (this.orderCounts[itemType] || 0) + 1
                orderCount--
            }
        } else {
            this.orderCounts[ItemTypes.BURGER] = this.itemOrderCount
            const cost = CostManager.getCost(ItemTypes.BURGER + "_price")
            this.orderValue += cost*this.itemOrderCount
        }

        this.itemsNeededCount = this.itemOrderCount
    }

    /**
     * Try to collect items from entities in the dropoff zone
     */
    private tryCollectFromEntities(deltaTime: number): void {
        if (this.playersInZone.size === 0 || this.itemsNeededCount <= 0) {
            return
        }

        this.collectionTimer.tick(deltaTime)

        if (!this.collectionTimer.isDone()) {
            return
        }

        for (const entity of this.playersInZone) {
            const hasInventoryComponent = entity.getComponent(HasInventory)
            if (!hasInventoryComponent) continue
            
            const inventory = hasInventoryComponent.getInventory()
            if (!inventory || inventory.isEmpty()) continue
            
            let itemToCollect: string | null = null
            for (const itemType in this.orderCounts) {
                if (this.orderCounts[itemType] > 0 && inventory.hasItemOfType(itemType)) {
                    itemToCollect = itemType
                    break
                }
            }

            if (!itemToCollect) continue

            const item = inventory.removeItem(itemToCollect)
            if (item) {
                this.inventory.addItemAnimated(item)

                if (this.orderCounts[itemToCollect] > 0) {
                    this.orderCounts[itemToCollect]--
                }
                this.itemsNeededCount--

                if (this.itemsNeededCount < 0) {
                    this.itemsNeededCount = 0
                }

                if (this.audioComponent) {
                    this.audioComponent.play("place burgers")
                }

                this.collectionTimer.reset()

                if (this.vipOrderIndicator) {
                    this.vipOrderIndicator.decrementOrderCount(itemToCollect)
                }

                break
            }
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
        this.characterAnimator.setWaitingForCashier(this.state === VIPCustomerState.ORDERING)
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

    private startLeaving(): void {
        this.cleanupDropoffZone()
        this.hideIndicators()
        this.navAgent.moveTo(this.spawnPosition)
        this.state = VIPCustomerState.LEAVING
    }

    /**
     * Get current state
     */
    public getState(): VIPCustomerState {
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

    private showIndicators(): void {
        if (this.targetPointerObject) {
            this.targetPointerObject.setEnabled(true)
            this.targetPointerObject.visible = true
        }
        if (this.vipOrderIndicator) {
            this.vipOrderIndicator.show()
        }
        if (this.targetPointer) {
            const worldPosition = new THREE.Vector3()
            this.gameObject.getWorldPosition(worldPosition)
            this.targetPointer.setTarget(worldPosition, 2)
        }
    }

    private hideIndicators(): void {
        if (this.targetPointerObject) {
            this.targetPointerObject.setEnabled(false)
            this.targetPointerObject.visible = false
        }
        if (this.vipOrderIndicator) {
            this.vipOrderIndicator.hide()
        }
    }

    protected onCleanup(): void {
        if (this.targetPointerObject) {
            this.targetPointerObject.dispose()
            this.targetPointerObject = null
            this.targetPointer = null
        }
    }
}

