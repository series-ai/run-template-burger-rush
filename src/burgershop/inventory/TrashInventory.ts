import * as THREE from "three"
import { Inventory } from "./Inventory"
import { Item } from "./Item"
import { TweenSystem, Easing } from "@series-inc/rundot-3d-engine/systems"

/**
 * Three.js version of TrashInventory component that manages trash inventory on tables using scattered positioning
 */
export class TrashInventory extends Inventory {
  private trashItems: Map<number, Item> = new Map() // Map position index to item
  public readonly maxItems: number = 3 // Each table can hold 1-3 trash items

  // 4 fixed positions on the table where trash can be scattered
  private readonly scatterPositions: THREE.Vector3[] = [
    new THREE.Vector3(-0.5, 0.0, -0.55),
    new THREE.Vector3(0.5, 0.0, -0.3),
    new THREE.Vector3(0.2, 0.0, 0.6),
    new THREE.Vector3(-0.5, 0.0, 0.4),
  ]

  /**
   * Create a new trash inventory component
   */
  constructor() {
    super()
  }

  protected onCreate(): void {
    // No specific initialization needed for trash inventory
  }

  /**
   * Get current number of items in inventory
   */
  public getItemCount(): number {
    return this.trashItems.size
  }

  /**
   * Check if inventory is full
   */
  public isFull(): boolean {
    return this.trashItems.size >= this.maxItems
  }

  /**
   * Check if inventory is empty
   */
  public isEmpty(): boolean {
    return this.trashItems.size === 0
  }

  /**
   * Get all items in the inventory
   */
  public getAllItems(): Item[] {
    return Array.from(this.trashItems.values())
  }

  /**
   * Add an item to the inventory
   */
  public addItem(item: Item): boolean {
    if (this.isFull()) {
      return false
    }

    // Find a free position for the trash item
    const freePositionIndex = this.findFreePosition()
    if (freePositionIndex === -1) {
      return false // No free positions
    }

    // Set the item's parent to this GameObject
    item.setParent(this.gameObject)

    // Position the item at the scatter position
    const scatterPosition = this.scatterPositions[freePositionIndex]
    item.setPosition(scatterPosition)

    // Store the item
    this.trashItems.set(freePositionIndex, item)

    // Add springy scale-in animation for game juice
    this.addScaleInAnimation(item)

    return true
  }

  /**
   * Add a springy scale-in animation to an item when it's placed
   */
  private addScaleInAnimation(item: Item): void {
    const itemGameObject = item.getGameObject()
    if (!itemGameObject) {
      return
    }

    // Start small and spring up to normal size
    const originalScale = 1.0
    const startScale = 0.4 // Less dramatic start
    const springDuration = 0.25 // Faster

    // Set initial small scale
    itemGameObject.scale.setScalar(startScale)

    // Spring up to normal size with gentle bounce
    const scaleUpTween = TweenSystem.tween(
      itemGameObject.scale,
      'x',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.8, 1.0) // More subtle spring
    )

    // Also animate Y and Z scales
    TweenSystem.tween(
      itemGameObject.scale,
      'y',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.8, 1.0)
    )

    TweenSystem.tween(
      itemGameObject.scale,
      'z',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.8, 1.0)
    )

    scaleUpTween.onCompleted(() => {
      // Ensure we're exactly at 1.0 (fix any floating point errors)
      itemGameObject.scale.setScalar(originalScale)
    })
  }

  /**
   * Remove an item from the inventory by type
   */
  public removeItem(itemType: string): Item | null {
    // Find an item of the specified type
    for (const [positionIndex, item] of this.trashItems.entries()) {
      if (item.itemType === itemType) {
        // Remove from map
        this.trashItems.delete(positionIndex)

        return item
      }
    }

    return null
  }

  /**
   * Check if inventory contains an item with the given type
   */
  public hasItemOfType(itemType: string): boolean {
    for (const item of this.trashItems.values()) {
      if (item.itemType === itemType) {
        return true
      }
    }
    return false
  }

  /**
   * Get all items of a specific type
   */
  public getItemsOfType(itemType: string): Item[] {
    const items: Item[] = []
    for (const item of this.trashItems.values()) {
      if (item.itemType === itemType) {
        items.push(item)
      }
    }
    return items
  }

  /**
   * Clear the inventory (remove all items)
   */
  public clear(): void {
    // Remove all items from GameObject hierarchy
    for (const item of this.trashItems.values()) {
      this.gameObject.remove(item.getGameObject())
    }

    // Clear the map
    this.trashItems.clear()
  }

  /**
   * Find a free position index for placing trash
   */
  private findFreePosition(): number {
    for (let i = 0; i < this.scatterPositions.length; i++) {
      if (!this.trashItems.has(i)) {
        return i
      }
    }
    return -1 // No free positions
  }

  protected onCleanup(): void {
    this.clear()
    super.onCleanup()
  }
}
