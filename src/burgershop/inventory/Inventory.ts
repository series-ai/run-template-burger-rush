import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Item } from "./Item"

/**
 * Abstract base class for inventory systems in Three.js
 */
export abstract class Inventory extends Component {
  /** The maximum number of items this inventory can hold */
  public abstract readonly maxItems: number

  /** Get current number of items in inventory */
  public abstract getItemCount(): number

  /** Check if inventory is full */
  public abstract isFull(): boolean

  /** Check if inventory is empty */
  public abstract isEmpty(): boolean

  /** Get all items in the inventory */
  public abstract getAllItems(): Item[]

  /** Add an item to the inventory */
  public abstract addItem(item: Item): boolean

  /** Remove an item from the inventory by type */
  public abstract removeItem(itemType: string): Item | null

  /** Check if inventory contains an item with the given type */
  public abstract hasItemOfType(itemType: string): boolean

  /** Get all items of a specific type */
  public abstract getItemsOfType(itemType: string): Item[]

  /** Clear the inventory (remove all items) */
  public abstract clear(): void

  /**
   * Check if inventory contains items other than the specified type
   * @param itemType The item type to exclude from the check
   * @returns true if there are items of other types, false otherwise
   */
  public hasItemsOtherThan(itemType: string): boolean {
    const allItems = this.getAllItems()
    return allItems.some((item) => item.itemType !== itemType)
  }

  /**
   * Get the owner GameObject of this inventory
   */
  public get owner(): GameObject {
    return this.gameObject
  }
}
