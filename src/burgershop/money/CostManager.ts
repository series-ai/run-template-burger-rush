/**
 * Centralized cost management system for the burger shop game
 * All costs are defined here with string keys for easy configuration
 */
export class CostManager {
  private static costs: Map<string, number> = new Map()

  /**
   * Get the cost for a given key
   * @param key The cost identifier
   * @returns The cost value, or 0 if not found
   */
  public static getCost(key: string): number {
    const cost = this.costs.get(key)
    if (cost === undefined) {
      console.warn(`Cost not found for key: ${key}, defaulting to 0`)
      return 0
    }
    return cost
  }

  /**
   * Set or update a cost
   * @param key The cost identifier
   * @param value The new cost value
   */
  public static setCost(key: string, value: number): void {
    this.costs.set(key, value)
  }

  /**
   * Get all costs as an object (useful for debugging/config)
   * @returns Object with all cost key-value pairs
   */
  public static getAllCosts(): Record<string, number> {
    const result: Record<string, number> = {}
    this.costs.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * Load costs from a configuration object
   * @param config Object with cost key-value pairs
   */
  public static loadCosts(config: Record<string, number>): void {
    Object.entries(config).forEach(([key, value]) => {
      this.costs.set(key, value)
    })
  }
}
