import * as THREE from "three"
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"
import {
    RigidBodyComponentThree,
    RigidBodyType,
    ColliderShape,
    Audio2D,
} from "@series-inc/rundot-3d-engine/systems"
import { DynamicNavSystem } from "@series-inc/rundot-3d-engine/systems"
import { InteractionZone } from "@series-inc/rundot-3d-engine"
import {
  BurgerShopDirectory,
  EmployeeInventory,
  PlayerInventory,
} from "@game"
import { MaxIndicator } from "@game/ui/index"
import { IUnlockable } from "@game/money/index"
import { PurchaseArea } from "@game/money/index"
import { UnlockManager } from "@game/money/index"
import { CostManager } from "@game/money/index"
import { PlayerComponent } from "@game"
import { Employee } from "@game/employee/index"
import { Timer } from "@game/Timer"
import { StationLevelComponent, StationLevelComponentConfig } from "@game/station-levels"
import { AnimationUtils } from "@game/shared"
import { ProductionStationConfig } from "./ProductionStationConfig"
import { Item, ItemStack, Inventory } from "@game/inventory"
import { CanPickupItems } from "./CanPickupItems"

/**
 * Production Station - Configurable station for producing items
 * Replaces item-specific stations like BurgerStation with a config-based approach
 */
export class ProductionStation extends Component implements IUnlockable {
    private config: ProductionStationConfig
    
    // Hierarchy containers
    private readonly stationComponentsObject: GameObject
    private readonly mainObject: GameObject
    private readonly counterObject: GameObject
    private mainMeshComponent: MeshRenderer

    // Generic inventory system (built-in)
    private inventory!: GenericProductionInventory
    private productionObject!: GameObject
    
    // Production system (built-in)
    private nextItemTimer: number = 0
    private currentLevel: number = 0
    private minProductionDuration: number = 3.5
    private maxProductionDuration: number = 3.5
    private isAcquired: boolean = false

    // Visual components (optional)
    private visualComponents: Component[] = []

    // Upgrade system
    private levelComponent!: StationLevelComponent
    private readonly levelObject: GameObject

    // Interaction system
    private interactionZone!: InteractionZone
    private interactionZoneObject!: GameObject
    private entitiesInZone: Set<GameObject> = new Set()

    // MAX indicator
    private maxIndicator!: MaxIndicator
    private camera: THREE.Camera | null = null

    // Audio component
    private audioComponent: Audio2D | null = null

    // Purchase system
    private purchaseArea: PurchaseArea | null = null
    private readonly purchaseAreaObject: GameObject

    private itemPickupTimer = new Timer(0.05)

    constructor(config: ProductionStationConfig) {
        super()
        this.config = config
        this.stationComponentsObject = config.stationComponentsObject
        this.mainObject = config.mainObject
        this.counterObject = config.counterObject
        this.mainMeshComponent = this.mainObject.getComponent(MeshRenderer)!
        this.purchaseAreaObject = config.purchaseAreaObject
        this.levelObject = config.upgradeObject
    }

    protected onCreate(): void {
        this.setupProductionSystem()
        this.setupInteractionZone()
        this.setupPurchaseArea()
        this.setupAudio()
        this.setupUpgradeSystem()

        // Start completely locked
        this.stationComponentsObject.setEnabled(false)
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }

        this.setupMaxIndicator()
    }

    private setupAudio(): void {
        this.audioComponent = new Audio2D([this.config.pickupSoundName])
        this.gameObject.addComponent(this.audioComponent)
    }

    // IUnlockable implementation
    public unlock(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(fromStorage: boolean = false): void {
        this.isAcquired = true
        this.stationComponentsObject.setEnabled(true)

        if (!fromStorage) {
            AnimationUtils.animateIn(this.stationComponentsObject)
        }

        BurgerShopDirectory.registerBurgerStation(this as any)
        this.setupNavigationObstacles()
        this.productionObject.setEnabled(true)

        this.setupUpgrades()
        if (this.levelObject) {
            this.levelObject.setEnabled(true)
        }
        this.levelComponent.enable()

        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
        }
    }

    private setupNavigationObstacles(): void {
        this.addMainObjectNavObstacle()

        DynamicNavSystem.addBoxObstacleFromBounds(
            this.counterObject,
            new THREE.Vector3(2, 1.5, 1)
        )
    }

    private addMainObjectNavObstacle(): void {
        DynamicNavSystem.addBoxObstacleFromBounds(
            this.mainObject,
            new THREE.Vector3(1.5, 1.5, 1)
        )
    }

    private removeMainObjectNavObstacle(): void {
        DynamicNavSystem.removeObstacleByGameObject(this.mainObject)
    }

    public getCost(): number {
        return CostManager.getCost(this.config.costKey)
    }

    public getDisplayName(): string {
        return this.config.displayName
    }

    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    private setupPurchaseArea(): void {
        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.config.costKey),
            this.config.purchaseAreaSize,
            this.config.purchaseAreaLabel,
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
        this.purchaseAreaObject.setEnabled(false)
    }

    public getCounterObject(): GameObject {
        return this.counterObject
    }

    public getMainObject(): GameObject {
        return this.mainObject
    }

    private setupProductionSystem(): void {
        // Create generic inventory
        this.inventory = new GenericProductionInventory(
            this.config.maxInventory[0],
            this.counterObject,
            this.config.stackPositions
        )
        this.counterObject.addComponent(this.inventory)

        // Create production GameObject
        this.productionObject = new GameObject("Production")
        this.stationComponentsObject.add(this.productionObject)

        // Setup visual components if factory provided
        // Factory creates GameObjects, attaches components, and adds to parent
        if (this.config.visualComponentsFactory) {
            this.visualComponents = this.config.visualComponentsFactory(this.productionObject)
        }

        // Set initial production duration
        this.minProductionDuration = this.config.productionDurations[0]
        this.maxProductionDuration = this.config.productionDurations[0]
        this.resetProductionTimer()

        this.productionObject.setEnabled(false)
    }

    private resetProductionTimer(): void {
        this.nextItemTimer = Math.random() * (this.maxProductionDuration - this.minProductionDuration) + this.minProductionDuration
    }

    private createItemInInventory(): void {
        const itemObject = new GameObject(`Item_${Date.now()}`)
        itemObject.position.set(0, 0, 0)

        const item = this.config.itemFactory()
        itemObject.addComponent(item)

        const success = this.inventory.addItem(item)
        if (!success) {
            itemObject.removeFromParent()
        }
    }

    private setupInteractionZone(): void {
        this.interactionZoneObject = new GameObject("InteractionZone")
        this.interactionZoneObject.position.copy(this.config.interactionZonePosition)
        this.stationComponentsObject.add(this.interactionZoneObject)

        this.interactionZone = new InteractionZone(
            (other: GameObject) => this.onEntityEnter(other),
            (other: GameObject) => this.onEntityExit(other),
            {
                width: this.config.interactionZoneSize.width,
                depth: this.config.interactionZoneSize.depth,
                active: true,
                show: false,
            },
        )

        this.interactionZoneObject.addComponent(this.interactionZone)
    }

    private setupMaxIndicator(): void {
        this.maxIndicator = new MaxIndicator({
            heightOffset: this.calculateTallestStackHeight() + 1.0,
        })

        if (this.camera && this.counterObject) {
            this.maxIndicator.attachTo(this.counterObject, this.camera)
        }
    }

    private onEntityEnter(entityGameObject: GameObject): void {
        const playerComponent = entityGameObject.getComponent(PlayerComponent)
        const employeeComponent = entityGameObject.getComponent(Employee)

        if (playerComponent || employeeComponent) {
            this.entitiesInZone.add(entityGameObject)
        }
    }

    private onEntityExit(entityGameObject: GameObject): void {
        const playerComponent = entityGameObject.getComponent(PlayerComponent)
        const employeeComponent = entityGameObject.getComponent(Employee)

        if (playerComponent || employeeComponent) {
            this.entitiesInZone.delete(entityGameObject)
        }
    }

    private tryGiveItemsToEntities(): void {
        if (this.inventory.isEmpty() || this.entitiesInZone.size === 0) {
            return
        }

        if (this.itemPickupTimer.isRunning()) {
            return
        }

        for (const entityGameObject of this.entitiesInZone) {
            const playerComponent = entityGameObject.getComponent(PlayerComponent)
            if (playerComponent) {
                this.giveItemToPlayer(playerComponent)
                continue
            }

            const employeeComponent = entityGameObject.getComponent(Employee)
            if (employeeComponent) {
                this.giveItemToEmployee(entityGameObject, employeeComponent)
                continue
            }
        }
    }

    private giveItemToPlayer(playerComponent: PlayerComponent) {
        const playerInventory = playerComponent.getInventory()
        const itemType = this.inventory.getFirstItemType()
        if (
            playerInventory &&
            !playerInventory.isFull() &&
            !playerInventory.hasItemsOtherThan(itemType)
        ) {
            this.giveItemToInventory(playerInventory, itemType)
        }
    }

    private giveItemToEmployee(entityGameObject: GameObject, employeeComponent: Employee) {
        const itemType = this.inventory.getFirstItemType()
        if (!itemType) return
        
        // Check if employee has permission to pick up this item type
        const canPickupItems = entityGameObject.getComponent(CanPickupItems)
        if (!canPickupItems || !canPickupItems.canPickup(itemType)) {
            return // Skip employees without permission for this item type
        }
        
        const employeeInventory = employeeComponent.getInventory()
        if (
            employeeInventory &&
            !employeeInventory.isFull() &&
            !employeeInventory.hasItemsOtherThan(itemType)
        ) {
            this.giveItemToInventory(employeeInventory, itemType)
        }
    }

    private giveItemToInventory(inventory: PlayerInventory | EmployeeInventory, itemType: string): boolean {
        const item = this.inventory.removeItem(itemType)
        if (item) {
            const success = inventory.addItemAnimated(item)
            if (success) {
                if (this.audioComponent) {
                    this.audioComponent.play(this.config.pickupSoundName)
                }

                const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
                if (tutorialSystem) {
                    tutorialSystem.getTracker().recordBurgerPickup()
                }

                this.itemPickupTimer.reset()
                return true
            } else {
                this.inventory.addItem(item)
            }
        }
        return false
    }

    public update(deltaTime: number): void {
        // Only run production and pickup if station has been acquired
        if (!this.isAcquired) {
            return
        }

        this.itemPickupTimer.tick(deltaTime)

        // Production system
        if (!this.inventory.isFull()) {
            this.nextItemTimer -= deltaTime
            if (this.nextItemTimer <= 0) {
                this.createItemInInventory()
                this.resetProductionTimer()
            }
        }

        this.tryGiveItemsToEntities()
        this.updateMaxIndicator()
    }

    private calculateTallestStackHeight(): number {
        if (!this.inventory) return 0

        const itemCount = this.inventory.getItemCount()
        const itemsPerStack = 4
        const tallestStackItems = Math.min(itemCount, itemsPerStack)

        const baseHeight = 1.45
        const stackHeight = tallestStackItems * 0.5

        return baseHeight + stackHeight
    }

    private updateMaxIndicator(): void {
        if (!this.maxIndicator) {
            return
        }

        const stackHeight = this.calculateTallestStackHeight()
        this.maxIndicator.updateHeightOffset(
            stackHeight + 0.8,
            this.counterObject || this.gameObject,
        )

        const isFull = this.inventory.isFull()

        if (isFull) {
            this.maxIndicator.show()
        } else {
            this.maxIndicator.hide()
        }

        if (this.camera) {
            const targetObject = this.counterObject || this.gameObject
            this.maxIndicator.update(targetObject, this.camera)
        }
    }

    public getInteractionZoneObject(): GameObject | null {
        return this.interactionZoneObject || null
    }

    public getPickupPosition(): THREE.Vector3 {
        if (this.interactionZoneObject) {
            return this.interactionZoneObject.getWorldPosition(new THREE.Vector3())
        }
        return this.gameObject.getWorldPosition(new THREE.Vector3())
    }

    public setCameraForUI(camera: THREE.Camera): void {
        this.camera = camera

        if (this.maxIndicator && this.counterObject) {
            this.maxIndicator.attachTo(this.counterObject, camera)
        }

        if (this.purchaseArea) {
            this.purchaseArea.setCamera(camera)
        }
    }

    public getCameraForUI(): THREE.Camera | null {
        return this.camera
    }

    public getInventory(): Inventory {
        return this.inventory
    }

    public hasItems(): boolean {
        return !this.inventory.isEmpty()
    }

    private setupUpgradeSystem(): void {
        const config: StationLevelComponentConfig = {
            costKeys: this.config.upgradeCostKeys,
            label: this.config.upgradeLabel,
            displayName: `${this.config.displayName} Upgrades`,
            size: new THREE.Vector2(2.5, 2),
            storageKey: `upgrade_level_${this.gameObject.name}`,
            onChange: (level: number, fromStorage?: boolean) => this.onLevelChanged(level, fromStorage),
            startUnlocked: this.config.upgradeStartUnlocked
        }

        this.levelComponent = new StationLevelComponent(config)
        this.levelObject.addComponent(this.levelComponent)

        this.levelObject.setEnabled(false)
    }

    private onLevelChanged(level: number, fromStorage: boolean = false): void {
        const meshName = this.config.upgradeMeshNames[Math.min(level, this.config.upgradeMeshNames.length - 1)]
        
        // Remove old navigation obstacle before mesh change
        if (this.isAcquired) {
            this.removeMainObjectNavObstacle()
        }
        
        if (fromStorage) {
            if (this.mainMeshComponent) {
                this.mainObject.removeComponent(MeshRenderer)
                while (this.mainObject.children.length > 0) {
                    const child = this.mainObject.children[0]
                    this.mainObject.remove(child)
                }
            }
            
            this.mainMeshComponent = new MeshRenderer(meshName)
            this.mainObject.addComponent(this.mainMeshComponent)
            
            // Re-add navigation obstacle after mesh change
            if (this.isAcquired) {
                this.addMainObjectNavObstacle()
            }
        } else {
            AnimationUtils.animateOut(this.mainObject, () => {
                if (this.mainMeshComponent) {
                    this.mainObject.removeComponent(MeshRenderer)
                    while (this.mainObject.children.length > 0) {
                        const child = this.mainObject.children[0]
                        this.mainObject.remove(child)
                    }
                }
                
                this.mainMeshComponent = new MeshRenderer(meshName)
                this.mainObject.addComponent(this.mainMeshComponent)

                AnimationUtils.animateIn(this.mainObject)
                
                // Re-add navigation obstacle after mesh change
                if (this.isAcquired) {
                    this.addMainObjectNavObstacle()
                }
            })

            AnimationUtils.quickBounce(this.counterObject, 'y', 1.15, 0.4)
        }

        // Update production stats
        const newDuration = this.config.productionDurations[Math.min(level, this.config.productionDurations.length - 1)]
        this.minProductionDuration = newDuration
        this.maxProductionDuration = newDuration
        
        const newCapacity = this.config.maxInventory[Math.min(level, this.config.maxInventory.length - 1)]
        this.inventory.setMaxItems(newCapacity)
    }

    public setupUpgrades(): void {
        this.levelComponent.setup()
    }

    public getLevelComponent(): StationLevelComponent {
        return this.levelComponent
    }

    protected onCleanup(): void {
        if (this.maxIndicator) {
            this.maxIndicator.dispose()
        }

        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
        }

        if (this.levelObject) {
            this.levelObject.dispose()
        }
    }
}

/**
 * Generic inventory for production stations
 * Handles any item type using ItemStack
 */
class GenericProductionInventory extends Inventory {
    public maxItems: number
    private itemStacks: ItemStack[] = []

    constructor(maxItems: number, parentObject: GameObject, stackPositions: THREE.Vector3[]) {
        super()
        this.maxItems = maxItems

        stackPositions.forEach((pos) => {
            const stack = new ItemStack(null as any, pos)
            stack.setParent(parentObject)
            this.itemStacks.push(stack)
        })
    }

    public getItemCount(): number {
        return this.itemStacks.reduce((total, stack) => total + stack.getItemCount(), 0)
    }

    public isFull(): boolean {
        return this.getItemCount() >= this.maxItems
    }

    public isEmpty(): boolean {
        return this.getItemCount() === 0
    }

    public getAllItems(): Item[] {
        const allItems: Item[] = []
        this.itemStacks.forEach((stack) => {
            allItems.push(...stack.getAllItems())
        })
        return allItems
    }

    public addItem(item: Item): boolean {
        if (this.isFull()) {
            return false
        }

        const sortedStacks = [...this.itemStacks].sort(
            (a, b) => a.getItemCount() - b.getItemCount()
        )
        const stack = sortedStacks[0]

        if (!stack) return false

        stack.addItem(item)
        return true
    }

    public removeItem(itemType: string): Item | null {
        const stacksWithItem = this.itemStacks.filter((stack) =>
            stack.hasItemOfType(itemType)
        )

        if (stacksWithItem.length === 0) {
            return null
        }

        stacksWithItem.sort((a, b) => b.getItemCount() - a.getItemCount())
        return stacksWithItem[0].removeItemOfType(itemType)
    }

    public hasItemOfType(itemType: string): boolean {
        return this.itemStacks.some((stack) => stack.hasItemOfType(itemType))
    }

    public getItemsOfType(itemType: string): Item[] {
        const items: Item[] = []
        this.itemStacks.forEach((stack) => {
            items.push(...stack.getItemsOfType(itemType))
        })
        return items
    }

    public clear(): void {
        this.itemStacks.forEach((stack) => {
            while (!stack.isEmpty()) {
                stack.removeLastItem()
            }
        })
    }

    public setMaxItems(newMax: number): void {
        this.maxItems = newMax
    }

    public getFirstItemType(): string {
        const allItems = this.getAllItems()
        return allItems.length > 0 ? allItems[0].itemType : ""
    }

    protected onCleanup(): void {
        this.itemStacks.forEach((stack) => stack.dispose())
        this.itemStacks = []
        super.onCleanup()
    }
}

