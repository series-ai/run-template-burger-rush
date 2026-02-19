/**
 * Global configuration for customer behavior per item type
 * Manages order count ranges and other item-specific customer settings
 */
export class CustomerConfig {
  private static orderRanges: Map<string, { min: number; max: number }> = new Map()

  /**
   * Set the order count range for a specific item type
   */
  public static setOrderRange(itemType: string, min: number, max: number): void {
    this.orderRanges.set(itemType, { min, max })
  }

  /**
   * Get a random order count for the specified item type
   * Returns a random integer between min and max (inclusive)
   */
  public static getOrderCountForItemType(itemType: string): number {
    const range = this.orderRanges.get(itemType)
    
    if (!range) {
      console.warn(`No order range configured for item type: ${itemType}, defaulting to 1`)
      return 1
    }

    // Generate random number between min and max (inclusive)
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
  }

  /**
   * Check if an item type has been configured
   */
  public static hasItemType(itemType: string): boolean {
    return this.orderRanges.has(itemType)
  }

  /**
   * Get all configured item types
   */
  public static getConfiguredItemTypes(): string[] {
    return Array.from(this.orderRanges.keys())
  }

  /**
   * Clear all configuration (mainly for testing)
   */
  public static clear(): void {
    this.orderRanges.clear()
  }
}

