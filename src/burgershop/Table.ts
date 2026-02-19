import * as THREE from "three"
import { Component, GameObject, InteractionZone, MeshRenderer } from "@series-inc/rundot-3d-engine"
import { AnimationUtils } from "@game/shared"
import { Customer, FoodInventory, Item, MoneyPile, TrashInventory } from "@game"
import { CostManager, IUnlockable, PurchaseArea, UnlockManager, } from "@game/money"
import { PlayerComponent } from "./PlayerComponent"
import { Trash } from "./Trash"
import { Employee } from "./employee"
import { CanPickupItems } from "./shared/CanPickupItems"
import {
  ColliderShape,
  DynamicNavSystem,
  RigidBodyComponentThree,
  RigidBodyType,
  StowKitSystem,
  ParticleSystemPrefabComponent,
  PrefabLoader,
} from "@series-inc/rundot-3d-engine/systems"
import { BurgerShopDirectory } from "./BurgerShopDirectory"
import { Timer } from "@game/Timer"
import { PrefabInstance } from "@game/prefabs"
import { TABLE_TRASH_MIN, TABLE_TRASH_MAX } from "./BurgerShopBalanceConfig"

export class Table extends Component implements IUnlockable {
    // Hierarchy containers
    private readonly display: PrefabInstance
    private readonly tableAndChairsParent: GameObject

    // Station components
    private readonly tableObject: GameObject
    private interactionZone!: InteractionZone
    private interactionZoneObject!: GameObject // Store reference for employee targeting
    private playersInZone: Set<GameObject> = new Set()
    private trashInventory!: TrashInventory
    private foodInventory!: FoodInventory
    private chairObjects: GameObject[] = []
    private chairOriginalRotations: THREE.Euler[] = []
    private chairsRotated: boolean = false

    // Chair assignment tracking
    private chairAssignments: (Customer | null)[] = []
    private inUse: boolean = false

    // Tips
    private moneyPile!: MoneyPile
    private readonly moneyPileObject!: GameObject

    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject: GameObject | null = null
    private costKey: string

    private trashPickupTimer: Timer = new Timer(0.04)

    // Flies particle effect
    private fliesParticleComponent: ParticleSystemPrefabComponent | null = null
    private fliesEffectHolder: GameObject | null = null
    private fliesPlaying: boolean = false

    constructor(prefab: PrefabInstance, costKey: string) {
        super()
        this.costKey = costKey
        this.display = prefab.getDescendantByPathOrThrow("/displays")
        this.moneyPileObject = prefab.getDescendantByPathOrThrow("/money_pile").gameObject
        this.tableAndChairsParent = this.display.gameObject
        this.tableAndChairsParent.setEnabled(false)
        this.tableObject = prefab.getDescendantByPathOrThrow("/displays/table_display").gameObject
    }

    protected onCreate() {
        this.createChairs()
        this.setupInteractionZone()
        this.setupTrashInventory()
        this.setupFoodInventory()
        this.setupPurchaseArea()
        this.setupMoneyPile()
        this.setupFliesParticle()

        this.tableAndChairsParent.setEnabled(false)


        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }

        // Table created
    }

    private createChairs(): void {

        this.display.children
            .filter(item => item.name.startsWith("chair_display_"))
            .forEach((child, index) => {

                const chairObject = child.gameObject

                // Chairs will gracefully handle if mesh doesn't exist
                this.chairOriginalRotations.push(chairObject.rotation.clone())
                this.chairObjects.push(chairObject)
                this.chairAssignments.push(null)
            }
        )
    }

    private setupTrashInventory(): void {
        const tableTop = new GameObject("TableTop")
        tableTop.position.set(0, 1.9, 0)
        this.tableAndChairsParent.add(tableTop)
        this.trashInventory = new TrashInventory()
        tableTop.addComponent(this.trashInventory)
    }

    private setupFoodInventory(): void {
        const tableFoodDisplay = new GameObject("TableFoodDisplay")
        tableFoodDisplay.position.set(0, 1.9, 0)
        this.tableAndChairsParent.add(tableFoodDisplay)
        this.foodInventory = new FoodInventory()
        tableFoodDisplay.addComponent(this.foodInventory)
    }

    private setupMoneyPile(): void {
        this.moneyPile = new MoneyPile()
        this.moneyPileObject.addComponent(this.moneyPile)
    }

    private setupFliesParticle(): void {
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const fliesPrefab = prefabCollection.getPrefabByName("pfx_flies")

        if (!fliesPrefab) {
            console.warn("pfx_flies prefab not found")
            return
        }

        // Create holder positioned 2 units above the table
        this.fliesEffectHolder = new GameObject("FliesEffectHolder")
        this.fliesEffectHolder.position.set(0, 2, 0)
        this.tableAndChairsParent.add(this.fliesEffectHolder)

        // Instantiate the prefab
        const instance = PrefabLoader.instantiatePrefab(fliesPrefab, this.fliesEffectHolder)
        this.fliesParticleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent) ?? null
    }

    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("TablePurchaseArea")
        this.purchaseAreaObject.position
            .copy((this.gameObject as GameObject).position)
            .add(new THREE.Vector3(0, 0, -0.5))

        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5),
            "Table",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
    }

    private setupInteractionZone(): void {
        this.interactionZoneObject = new GameObject("TableInteractionZone")
        this.interactionZoneObject.position.set(0, 0, 0)
        this.tableAndChairsParent.add(this.interactionZoneObject)

        this.interactionZone = new InteractionZone(
            (other: GameObject) => this.onInteractionZoneEnter(other),
            (other: GameObject) => this.onInteractionZoneExit(other),
            {
                width: 4,
                depth: 4,
                show: false,
            },
        )

        this.interactionZoneObject.addComponent(this.interactionZone)
    }

    private onInteractionZoneEnter(gameObject: GameObject): void {
        const playerComponent = gameObject.getComponent(PlayerComponent)
        const employee = gameObject.getComponent(Employee)
        if (playerComponent || employee) {
            this.playersInZone.add(gameObject)
        }
    }

    private onInteractionZoneExit(gameObject: GameObject): void {
        const playerComponent = gameObject.getComponent(PlayerComponent)
        const employee = gameObject.getComponent(Employee)
        if (playerComponent || employee) {
            this.playersInZone.delete(gameObject)
        }
    }

    public update(deltaTime: number): void {
        this.trashPickupTimer.tick(deltaTime)
        this.tryGiveTrashToPlayers()
        this.updateFliesEffect()
    }

    private updateFliesEffect(): void {
        if (!this.fliesParticleComponent) return

        const hasTrash = this.hasTrash()

        if (hasTrash && !this.fliesPlaying) {
            this.fliesParticleComponent.play()
            this.fliesPlaying = true
        } else if (!hasTrash && this.fliesPlaying) {
            this.fliesParticleComponent.stop()
            this.fliesPlaying = false
        }
    }

    private tryGiveTrashToPlayers(): void {
        if (this.playersInZone.size === 0 || this.trashInventory.isEmpty()) {
            return
        }

        if (!this.trashPickupTimer.isDone()){
            return
        }

        for (const playerGameObject of this.playersInZone) {
            const playerComponent =
                playerGameObject.getComponent(PlayerComponent)
            const employee = playerGameObject.getComponent(Employee)
            if (!playerComponent && !employee) continue

            // For employees, check if they have pickup permission for trash
            if (employee) {
                const canPickupItems = playerGameObject.getComponent(CanPickupItems)
                if (!canPickupItems || !canPickupItems.canPickup(Trash.ITEM_TYPE)) {
                    continue // Skip employees without permission for trash
                }
            }

            const playerInventory = playerComponent
                ? playerComponent.getInventory()
                : employee?.getInventory()
            if (!playerInventory || playerInventory.isFull()) continue

            if (playerInventory.hasItemsOtherThan(Trash.ITEM_TYPE)) continue

            const trashItem = this.trashInventory.removeItem(Trash.ITEM_TYPE)
            if (trashItem) {
                const success = playerInventory.addItemAnimated(trashItem)
                if (!success) {
                    this.trashInventory.addItem(trashItem)
                } else {
                    // Record trash pickup from table for tutorial tracking
                    const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
                    if (tutorialSystem) {
                        tutorialSystem.getTracker().recordTrashPickupFromTable()
                    }

                    // Restore chair rotations when all trash is picked up
                    if (this.trashInventory.isEmpty() && this.chairsRotated) {
                        this.restoreChairRotations()
                        this.chairsRotated = false
                    }
                    this.trashPickupTimer.reset()
                }
                break
            }
        }
    }


    private rotateChairsRandomly(): void {
        this.chairObjects.forEach((chair, index) => {
            if (chair && this.chairOriginalRotations[index]) {
                const randomRotation =
                    (Math.random() - 0.5) * 2 * ((80 * Math.PI) / 180)
                const originalY = this.chairOriginalRotations[index].y

                chair.rotation.set(
                    this.chairOriginalRotations[index].x,
                    originalY + randomRotation,
                    this.chairOriginalRotations[index].z,
                )
            }
        })
    }

    private restoreChairRotations(): void {
        this.chairObjects.forEach((chair, index) => {
            if (chair && this.chairOriginalRotations[index]) {
                chair.rotation.copy(this.chairOriginalRotations[index])
            }
        })
    }

    public addTrash(): boolean {
        if (this.trashInventory.isFull()) {
            return false
        }

        // Check if this is the first piece of trash before adding
        const wasEmpty = this.trashInventory.isEmpty()

        const trashGameObject = new GameObject("Trash")
        const trashComponent = new Trash()
        trashGameObject.addComponent(trashComponent)

        const success = this.trashInventory.addItem(trashComponent)
        if (!success) {
            trashGameObject.dispose()
        } else {
            // Rotate chairs when first trash is added
            if (wasEmpty && !this.chairsRotated) {
                this.rotateChairsRandomly()
                this.chairsRotated = true
            }

            // Record first dirty table for tutorial tracking
            const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
            if (tutorialSystem) {
                tutorialSystem.getTracker().recordFirstDirtyTable()
            }
        }

        return success
    }

    public hasSpaceForTrash(): boolean {
        return !this.trashInventory.isFull()
    }

    public hasTrash(): boolean {
        return !this.trashInventory.isEmpty()
    }

    public isAvailable(): boolean {
        // Table has available chairs if at least one chair is empty and table is clean
        return this.hasAvailableChair() && !this.hasTrash() && !this.inUse
    }

    /**
     * Check if the table has at least one available chair
     */
    private hasAvailableChair(): boolean {
        return this.chairAssignments.some(chair => chair === null)
    }

    /**
     * Check if the table is full (both chairs occupied)
     */
    public isFull(): boolean {
        return this.chairAssignments.every(chair => chair !== null)
    }

    /**
     * Get the number of occupied chairs
     */
    public getOccupiedChairCount(): number {
        return this.chairAssignments.filter(chair => chair !== null).length
    }

    /**
     * Get the GameObject this component is attached to (for compatibility with customer system)
     */
    public getGameObject(): GameObject {
        return this.gameObject
    }

    /**
     * Assign a customer to an available chair
     * @returns The chair index (0 or 1) if successful, -1 if no chairs available
     */
    public assignCustomerAndGetChair(customer: Customer): GameObject {
        let chair: GameObject | null = null
        let chairIndex: number = 0
        for (let i = 0; i < this.chairAssignments.length; i++) {
            if (this.chairAssignments[i] === null) {
                this.chairAssignments[i] = customer
                chair = this.chairObjects[i]
                chairIndex = i
                break
            }
        }

        if (chairIndex === this.chairAssignments.length - 1) {
            this.inUse = true
        }

        return chair!
    }

    /**
     * Release a specific customer from their chair
     */
    public customerFinishedEating(customer: Customer): void {
        for (let i = 0; i < this.chairAssignments.length; i++) {
            if (this.chairAssignments[i] === customer) {
                this.chairAssignments[i] = null
                break
            }
        }

        // When last customer leaves, generate trash and mark table not in use
        if (this.chairAssignments.every(chair => chair === null)) {
            this.inUse = false
            
            // Generate trash items per table (not per customer)
            const trashCount = TABLE_TRASH_MIN + Math.floor(Math.random() * (TABLE_TRASH_MAX - TABLE_TRASH_MIN + 1))
            for (let i = 0; i < trashCount; i++) {
                this.addTrash()
            }
        }

        const minTip = CostManager.getCost("table_tip_min")
        const maxTip = CostManager.getCost("table_tip_max")
        const tip = minTip + Math.floor(Math.random() * (maxTip - minTip + 1))
        this.moneyPile.addMoney(tip)
    }

    /**
     * Get all assigned customers
     */
    public getAssignedCustomers(): any[] {
        return this.chairAssignments.filter(customer => customer !== null)
    }

    /**
     * Get the item types of all customers currently at the table
     * Used to prevent mixing different item types (burgers vs shakes) at the same table
     */
    public getCustomerItemTypes(): Set<string> {
        const itemTypes = new Set<string>()
        for (const customer of this.chairAssignments) {
            if (customer !== null) {
                const itemType = customer.getDesiredItemType()
                if (itemType) {
                    itemTypes.add(itemType)
                }
            }
        }
        return itemTypes
    }

    public getTrashInventory(): TrashInventory {
        return this.trashInventory
    }

    public AddItemToFoodInventory(item: Item): void {
        this.foodInventory.addItem(item)
    }

    public TableIsFullOfEatingCustomers(): boolean {
        return this.chairAssignments.every(customer => customer !== null && customer.isEating())
    }

    public getFoodCount(): number {
        return this.foodInventory.getItemCount()
    }

    public areCustomersHeadingToTable(): boolean {
        return this.chairAssignments.some(customer => customer !== null && !customer.isEating())
    }

    public removeFoodItems(count: number): void {
        this.foodInventory.removeItems(count)
    }

    public hasFood(): boolean {
        return !this.foodInventory.isEmpty()
    }

    public getFoodInventory(): FoodInventory {
        return this.foodInventory
    }

    protected onCleanup(): void {
        if (this.tableObject) {
            this.tableObject.dispose()
        }

        this.chairObjects.forEach((chair) => {
            chair.dispose()
        })
        this.chairObjects = []
        this.chairOriginalRotations = []

        if (this.fliesEffectHolder) {
            this.fliesEffectHolder.dispose()
            this.fliesEffectHolder = null
        }
        this.fliesParticleComponent = null
        this.fliesPlaying = false

        this.playersInZone.clear()
    }

    // IUnlockable interface methods
    public unlock(): void {
        // Table unlocked

        // Enable the purchase area so players can see and interact with it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(fromStorage: boolean = false): void {
        // Table purchased
        // Note: UnlockManager.acquire() is called by the PurchaseArea, not here

        // Enable the entire station components container (includes table, chairs, interaction zone)
        this.tableAndChairsParent.setEnabled(true)

        // Animate the table bouncing in (but not when loading from storage)
        if (!fromStorage) {
            AnimationUtils.animateIn(this.tableAndChairsParent)
        }

        // Register with directory now that table is active
        BurgerShopDirectory.registerTable(this)

        // Add navigation obstacles now that station is active
        this.setupNavigationObstacle()

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
    }

    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    public getDisplayName(): string {
        return "Table"
    }

    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    // Legacy methods for compatibility
    public onUnlock(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Setup navigation obstacle for the table (like original Table.ts)
     */
    private setupNavigationObstacle(): void {
        DynamicNavSystem.addBoxObstacleFromBounds(this.tableObject, new THREE.Vector3(1, 0, 1))
    }

    public getPickupPosition(): THREE.Vector3 {
        return (
            this.interactionZone.getGameObject() as GameObject
        ).getWorldPosition(new THREE.Vector3())
    }

    /**
     * Expose the interaction zone object for AI to target (world position will be used by agents)
     */
    public getInteractionZoneObject(): GameObject | null {
        return this.interactionZoneObject || null
    }

    public getWorkPosition(): THREE.Vector3 {
        return (this.gameObject as GameObject).position
            .clone()
            .add(new THREE.Vector3(-2, 0, -2.5))
    }

    public getChairPositions(): THREE.Vector3[] {
        const tablePosition = (this.gameObject as GameObject).position
        return [
            tablePosition.clone().add(new THREE.Vector3(0, 0, -2.3)),
            tablePosition.clone().add(new THREE.Vector3(0, 0, 2.3)),
        ]
    }

    /**
     * Get the position of a specific chair by index
     */
    public getChairPosition(chairIndex: number): THREE.Vector3 {
        const chairPositions = this.getChairPositions()
        return chairPositions[chairIndex] || chairPositions[0]
    }

    /**
     * Get the position of the next available chair
     */
    public getAvailableChairPosition(): THREE.Vector3 | null {
        for (let i = 0; i < this.chairAssignments.length; i++) {
            if (this.chairAssignments[i] === null) {
                return this.getChairPosition(i)
            }
        }
        return null
    }

    public getRandomChairPosition(): THREE.Vector3 {
        const chairPositions = this.getChairPositions()
        const randomIndex = Math.floor(Math.random() * chairPositions.length)
        return chairPositions[randomIndex]
    }
}
