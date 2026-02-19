import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { Item } from "./Item"
import { ItemStack } from "./ItemStack"

/**
 * Simplified food inventory component that manages food items on tables
 * Just handles basic item stack operations for adding/removing food items
 */
export class FoodInventory extends Component {
  private itemStack!: ItemStack

  /**
   * Create a new food inventory component
   */
  constructor() {
    super()
  }

  protected onCreate(): void {
    // Create item stack at center of the table surface
    this.itemStack = new ItemStack(
      this.scene,
      new THREE.Vector3(0, 0, 0), // Center position - relative to TableFoodDisplay
    )
    this.itemStack.setParent(this.gameObject)
  }

  /**
   * Get current number of items in inventory
   */
  public getItemCount(): number {
    return this.itemStack.getItemCount()
  }

  /**
   * Check if inventory is empty
   */
  public isEmpty(): boolean {
    return this.itemStack.getItemCount() === 0
  }

  /**
   * Add an item to the inventory with proper stacking
   */
  public addItem(item: Item): boolean {
    this.itemStack.addItem(item)
    return true
  }

  /**
   * Remove items from the stack
   * @param count The number of items to remove
   * @returns Array of removed items
   */
  public removeItems(count: number): void {    
    for (let i = 0; i < count; i++) {
      const item = this.itemStack.removeLastItem()
      item?.getGameObject().dispose();
    }
  }
}
