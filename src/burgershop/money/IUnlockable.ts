/**
 * Interface for components that can be unlocked and acquired in the Three.js system
 * Used by UnlockManager to manage purchase dependencies
 */
export interface IUnlockable {
  /**
   * Called when this item becomes available for purchase
   * Should enable the purchase area and make the item visible to players
   */
  unlock(): void

  /**
   * Called when this item has been acquired (purchased/built)
   * Should enable the actual functionality and remove the purchase area
   * @param fromStorage If true, this is being loaded from storage (skip animations)
   */
  acquire(fromStorage?: boolean): void

  /**
   * Get the cost of this item for purchase
   */
  getCost(): number

  /**
   * Get a display name for this item (for logging/debugging)
   */
  getDisplayName(): string

  /**
   * Get the unique ID for this unlockable item
   */
  getUnlockableId(): string
}
