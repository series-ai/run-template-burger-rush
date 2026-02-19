import * as THREE from "three"
import { Item, ItemStack, Inventory } from "@game/inventory"
import { GameObject } from "@series-inc/rundot-3d-engine"

/**
 * Employee inventory component that follows the employee and holds items
 * Similar to PlayerInventory but optimized for AI behavior
 */
export class EmployeeInventory extends Inventory {
  private itemStack!: ItemStack

  // Static inventory size that can be modified by HR upgrades
  public static maxInventorySize: number = 2

  /**
   * Get the current maximum items (required by Inventory abstract class)
   */
  public get maxItems(): number {
    return EmployeeInventory.maxInventorySize
  }

  /**
   * Called when component is attached to GameObject
   */
  protected onCreate(): void {
    // Create item stack for inventory management (no visual indicator)
    const stackPosition = new THREE.Vector3(0, 1, 0.9) // Position relative to employee
    this.itemStack = new ItemStack(this.scene, stackPosition)
    this.itemStack.setParent(this.getGameObject())
  }

  /**
   * Add an item to the inventory
   */
  public addItem(item: Item): boolean {
    if (this.isFull()) {
      return false
    }

    // ItemStackThree.addItem returns void, so we check if it succeeded by verifying the item was added
    const initialCount = this.itemStack.getItemCount()
    this.itemStack.addItem(item)
    const success = this.itemStack.getItemCount() > initialCount

    return success
  }

  public addItemAnimated(item: Item) {
    if (this.isFull()) {
      return false
    }

    // ItemStackThree.addItem returns void, so we check if it succeeded by verifying the item was added
    const initialCount = this.itemStack.getItemCount()
    this.itemStack.addItemAnimated(item)
    const success = this.itemStack.getItemCount() > initialCount

    return success
  }

  /**
   * Remove an item from the inventory by type
   */
  public removeItem(itemType: string): Item | null {
    const item = this.itemStack.removeItemOfType(itemType)
    return item
  }

  /**
   * Get the current number of items
   */
  public getItemCount(): number {
    return this.itemStack.getItemCount()
  }

  /**
   * Check if the inventory is full
   */
  public isFull(): boolean {
    return this.getItemCount() >= this.maxItems
  }

  /**
   * Check if the inventory is empty
   */
  public isEmpty(): boolean {
    return this.getItemCount() === 0
  }

  /**
   * Get all items in the inventory
   */
  public getAllItems(): Item[] {
    return this.itemStack.getAllItems()
  }

  /**
   * Check if inventory contains an item with the given type
   */
  public hasItemOfType(itemType: string): boolean {
    return this.itemStack.hasItemOfType(itemType)
  }

  /**
   * Get all items of a specific type
   */
  public getItemsOfType(itemType: string): Item[] {
    return this.itemStack.getItemsOfType(itemType)
  }

  /**
   * Clear all items from the inventory
   */
  public clear(): void {
    // Remove all items from the stack manually
    while (!this.itemStack.isEmpty()) {
      this.itemStack.removeLastItem()
    }
  }
}
