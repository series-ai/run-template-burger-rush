import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

/**
 * Centralized manager for station upgrade levels - loads all levels at startup
 * Must call initialize() before use to load saved data (in BurgerShopDemo Promise.all)
 * 
 * This eliminates race conditions by pre-loading all station levels at startup
 * rather than lazy-loading them when each station is acquired.
 */
export class StationLevelManager {
  private static readonly STORAGE_KEY = "burger_shop_station_levels"

  // All station levels stored by their storage key
  private static levels: Map<string, number> = new Map()

  // Track initialization state
  private static isInitialized: boolean = false

  /**
   * Initialize the manager by loading all saved station levels from storage
   * Must be called during startup (in Promise.all with other systems)
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("⚠️ StationLevelManager already initialized!")
      return
    }

    try {
      const saved = await RundotGameAPI.appStorage.getItem(this.STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved) as Record<string, number>
        for (const [key, level] of Object.entries(data)) {
          if (typeof level === "number" && level >= 0) {
            this.levels.set(key, level)
          }
        }
      }
      this.isInitialized = true
    } catch (error) {
      console.warn("Failed to load station levels:", error)
      this.isInitialized = true // Continue anyway with empty state
    }
  }

  /**
   * Get the level for a station by its storage key
   * Returns 0 if not found or not initialized
   */
  public static getLevel(storageKey: string): number {
    if (!this.isInitialized) {
      console.warn("⚠️ StationLevelManager not initialized! Call initialize() first.")
      return 0
    }
    return this.levels.get(storageKey) ?? 0
  }

  /**
   * Set the level for a station and save to storage (fire-and-forget)
   */
  public static setLevel(storageKey: string, level: number): void {
    if (!this.isInitialized) {
      console.warn("⚠️ StationLevelManager not initialized! Call initialize() first.")
      return
    }

    this.levels.set(storageKey, level)
    this.saveToStorage()
  }

  /**
   * Check if the manager is initialized
   */
  public static isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Save all levels to storage (fire-and-forget, non-blocking)
   */
  private static saveToStorage(): void {
    try {
      const data: Record<string, number> = {}
      for (const [key, level] of this.levels.entries()) {
        data[key] = level
      }
      // Fire-and-forget save - don't await
      RundotGameAPI.appStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn("Failed to save station levels:", error)
    }
  }

  /**
   * Clear all station levels (for debug/reset)
   */
  public static async clearStorage(): Promise<void> {
    try {
      this.levels.clear()
      await RundotGameAPI.appStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn("Failed to clear station levels:", error)
    }
  }

  /**
   * Reset a specific station level (for debug/reset)
   */
  public static resetLevel(storageKey: string): void {
    this.levels.delete(storageKey)
    this.saveToStorage()
  }
}
