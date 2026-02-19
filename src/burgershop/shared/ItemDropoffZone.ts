import * as THREE from "three"
import { GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { Audio2D } from "@series-inc/rundot-3d-engine/systems"
import { Inventory, Item, ItemStack, HasInventory } from "@game/inventory"
import { Timer } from "@game/Timer"
import { DeliveryTarget } from "./DeliveryTarget"

/**
 * Configuration for ItemDropoffZone component
 */
export interface ItemDropoffZoneConfig {
    zoneSize: { width: number; depth: number }
    zonePosition: THREE.Vector3
    itemType: string
    stackPositions: THREE.Vector3[]
    audioClipName?: string
    onItemCollected?: (item: Item) => void
}

/**
 * Reusable component for collecting items from entities with inventories.
 * Manages an InteractionZone, tracks entities, and stores collected items in ItemStacks.
 * Implements Inventory interface for compatibility with existing systems.
 */
export class ItemDropoffZone extends Inventory {
    private readonly COLLECTION_INTERVAL = 0.05

    // Configuration
    private config: ItemDropoffZoneConfig
    private itemType: string
    private audioClipName?: string
    private onItemCollected?: (item: Item) => void

    // Inventory abstract property
    public readonly maxItems: number = Infinity

    // Storage
    private itemStacks: ItemStack[] = []

    // Collection management
    private collectionTimer: Timer
    private interactionZone!: InteractionZone
    private interactionZoneObject!: GameObject
    private entitiesInZone: Set<GameObject> = new Set()

    // Audio
    private audioComponent: Audio2D | null = null

    constructor(config: ItemDropoffZoneConfig) {
        super()
        this.config = config
        this.itemType = config.itemType
        this.audioClipName = config.audioClipName
        this.onItemCollected = config.onItemCollected
        this.collectionTimer = new Timer(this.COLLECTION_INTERVAL)
    }

    protected onCreate(): void {
        this.setupInteractionZone()
        this.setupItemStacks()
        this.setupAudio()
    }

    /**
     * Setup the interaction zone for detecting entities
     */
    private setupInteractionZone(): void {
        this.interactionZoneObject = new GameObject("ItemDropoffZone")
        this.interactionZoneObject.position.copy(this.config.zonePosition)
        this.gameObject.add(this.interactionZoneObject)

        this.interactionZone = new InteractionZone(
            (entity: GameObject) => this.onEntityEnter(entity),
            (entity: GameObject) => this.onEntityExit(entity),
            {
                width: this.config.zoneSize.width,
                depth: this.config.zoneSize.depth,
                active: true,
                show: false,
            }
        )
        this.interactionZoneObject.addComponent(this.interactionZone)
    }

    /**
     * Setup item stacks at specified positions
     */
    private setupItemStacks(): void {
        this.config.stackPositions.forEach((pos) => {
            const stack = new ItemStack(null as any, pos)
            stack.setParent(this.gameObject)
            this.itemStacks.push(stack)
        })
    }

    /**
     * Setup audio component if audio clip name is provided
     */
    private setupAudio(): void {
        if (this.audioClipName) {
            this.audioComponent = new Audio2D([this.audioClipName])
            this.gameObject.addComponent(this.audioComponent)
        }
    }

    /**
     * Handle entity entering the interaction zone
     */
    private onEntityEnter(entity: GameObject): void {
        // Check if entity has a HasInventory component
        const hasInventory = entity.getComponent(HasInventory)
        if (hasInventory) {
            this.entitiesInZone.add(entity)
        }
    }

    /**
     * Handle entity exiting the interaction zone
     */
    private onEntityExit(entity: GameObject): void {
        this.entitiesInZone.delete(entity)
    }

    /**
     * Update function - tick timer and try to collect items
     */
    public update(deltaTime: number): void {
        this.collectionTimer.tick(deltaTime)
        this.tryCollectFromEntities()
    }

    /**
     * Try to collect items from entities in the zone
     */
    private tryCollectFromEntities(): void {
        // Check if timer is running or zone is empty
        if (this.entitiesInZone.size === 0 || this.collectionTimer.isRunning()) {
            return
        }

        // Try each entity in zone
        for (const entity of this.entitiesInZone) {
            // Check if entity has a DeliveryTarget component
            // If so, only accept items if we're the target
            const deliveryTarget = entity.getComponent(DeliveryTarget)
            if (deliveryTarget && !deliveryTarget.isTarget(this)) {
                // Entity has a specific target and it's not us - skip
                continue
            }

            // Get inventory via HasInventory component
            const hasInventoryComponent = entity.getComponent(HasInventory)
            if (!hasInventoryComponent) continue
            
            const inventory = hasInventoryComponent.getInventory()
            if (!inventory || inventory.isEmpty()) continue
            
            // Check for specific item type
            if (!inventory.hasItemOfType(this.itemType)) continue

            // Remove item from entity inventory
            const item = inventory.removeItem(this.itemType)
            if (item) {
                // Add to our ItemStack with animation
                const success = this.addItemAnimated(item)
                if (!success) {
                    // Put back if couldn't add
                    inventory.addItem(item)
                } else {
                    // Fire callback
                    if (this.onItemCollected) {
                        this.onItemCollected(item)
                    }

                    // Play audio
                    if (this.audioComponent && this.audioClipName) {
                        this.audioComponent.play(this.audioClipName)
                    }

                    // Reset timer
                    this.collectionTimer.reset()
                }
                // Only collect one item per frame
                break
            }
        }
    }

    /**
     * Add item to stack with animation
     */
    private addItemAnimated(item: Item): boolean {
        // Find stack with fewest items
        const sortedStacks = [...this.itemStacks].sort(
            (a, b) => a.getItemCount() - b.getItemCount()
        )
        const stack = sortedStacks[0]

        if (!stack) return false

        stack.addItemAnimated(item)
        return true
    }

    // Inventory interface implementation

    /**
     * Get total item count across all stacks
     */
    public getItemCount(): number {
        return this.itemStacks.reduce(
            (total, stack) => total + stack.getItemCount(),
            0
        )
    }

    /**
     * Check if inventory is full (always false - unlimited capacity)
     */
    public isFull(): boolean {
        return false
    }

    /**
     * Check if inventory is empty
     */
    public isEmpty(): boolean {
        return this.getItemCount() === 0
    }

    /**
     * Get all items from all stacks
     */
    public getAllItems(): Item[] {
        const allItems: Item[] = []
        this.itemStacks.forEach((stack) => {
            allItems.push(...stack.getAllItems())
        })
        return allItems
    }

    /**
     * Add item to the stack with fewest items
     */
    public addItem(item: Item): boolean {
        const sortedStacks = [...this.itemStacks].sort(
            (a, b) => a.getItemCount() - b.getItemCount()
        )
        const stack = sortedStacks[0]

        if (!stack) return false

        stack.addItem(item)
        return true
    }

    /**
     * Remove item from the biggest stack (like CheckoutInventory pattern)
     */
    public removeItem(itemType: string): Item | null {
        // Find all stacks that have the specified item type
        const stacksWithItem = this.itemStacks.filter((stack) =>
            stack.hasItemOfType(itemType)
        )

        if (stacksWithItem.length === 0) {
            return null
        }

        // Sort by item count in descending order (biggest stack first)
        stacksWithItem.sort((a, b) => b.getItemCount() - a.getItemCount())

        // Remove from the biggest stack
        return stacksWithItem[0].removeItemOfType(itemType)
    }

    /**
     * Check if any stack has items of the specified type
     */
    public hasItemOfType(itemType: string): boolean {
        return this.itemStacks.some((stack) => stack.hasItemOfType(itemType))
    }

    /**
     * Get all items of a specific type from all stacks
     */
    public getItemsOfType(itemType: string): Item[] {
        const items: Item[] = []
        this.itemStacks.forEach((stack) => {
            items.push(...stack.getItemsOfType(itemType))
        })
        return items
    }

    /**
     * Clear all items from all stacks
     */
    public clear(): void {
        this.itemStacks.forEach((stack) => {
            while (!stack.isEmpty()) {
                const item = stack.removeLastItem()
                if (item) {
                    // Items will be disposed elsewhere
                }
            }
        })
    }

    /**
     * Get the interaction zone GameObject for external positioning
     */
    public getInteractionZoneObject(): GameObject {
        return this.interactionZoneObject
    }

    /**
     * Component cleanup
     */
    protected onCleanup(): void {
        this.itemStacks.forEach((stack) => stack.dispose())
        this.itemStacks = []
        super.onCleanup()
    }
}

