import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { Item, ItemStack } from "@game/inventory"

/**
 * Simplified customer inventory component that manages food items customers carry
 * Uses ItemStack for consistent behavior with other inventories
 */
export class CustomerInventory extends Component {
  private itemStack!: ItemStack

  protected onCreate(): void {
    // Create item stack in front of customer
    this.itemStack = new ItemStack(
      this.scene,
      new THREE.Vector3(0, 1, 0.9) // In front of customer
    )
    this.itemStack.setParent(this.gameObject)
  }

  /**
   * Add an item to the customer's inventory
   */
  public addItem(item: Item): boolean {
    this.itemStack.addItem(item)
    return true
  }

  public addItemAnimated(item: Item): boolean {
    this.itemStack.addItemAnimated(item)
    return true
  }

  /**
   * Remove an item from the customer's inventory
   */
  public removeItem(): Item | null {
    return this.itemStack.removeLastItem()
  }

  /**
   * Get all items in the inventory
   */
  public getAllItems(): Item[] {
    return this.itemStack.getAllItems()
  }

  /**
   * Get the number of items in the inventory
   */
  public getItemCount(): number {
    return this.itemStack.getItemCount()
  }
}
