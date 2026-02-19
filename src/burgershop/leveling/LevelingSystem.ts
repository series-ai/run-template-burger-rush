import { UnlockManager, UnlockableComponent } from "../money"
import { XP_PER_DOLLAR } from "../BurgerShopBalanceConfig"

/**
 * Leveling system that tracks player XP and level based on acquired items
 * XP is calculated from the cost of acquired unlockables
 * Level thresholds are passed in during initialization
 */
export class LevelingSystem {
  private static totalXP: number = 0
  private static currentLevel: number = 1
  private static isInitialized: boolean = false
  private static levelThresholds: number[] = [0]

  // Level change listeners
  private static levelChangeListeners: ((oldLevel: number, newLevel: number) => void)[] = []

  /**
   * Initialize the leveling system
   * @param thresholds Array of XP thresholds for each level (already adjusted for starting money)
   * Must be called after UnlockManager is initialized and all unlockables are registered
   */
  public static initialize(thresholds: number[]): void {
    if (this.isInitialized) {
      console.warn("LevelingSystem already initialized")
      return
    }

    this.levelThresholds = thresholds

    // Calculate initial XP from already-acquired items
    this.calculateInitialXP()

    // Listen for new acquisitions
    UnlockManager.addAcquireListener((acquiredItem: UnlockableComponent) => {
      this.onItemAcquired(acquiredItem)
    })

    this.isInitialized = true
    console.log(`LevelingSystem initialized - Level ${this.currentLevel}, XP ${this.totalXP}`)
  }

  /**
   * Calculate initial XP from all previously acquired items
   */
  private static calculateInitialXP(): void {
    const acquiredIds = UnlockManager.getAcquiredItems()
    
    let initialXP = 0
    for (const id of acquiredIds) {
      const unlockable = UnlockManager.getUnlockableById(id)
      if (unlockable) {
        const cost = unlockable.getCost()
        initialXP += cost * XP_PER_DOLLAR
      }
    }

    this.totalXP = initialXP
    this.currentLevel = this.calculateLevelFromXP(this.totalXP)
  }

  /**
   * Handle when an item is acquired - add XP and check for level up
   */
  private static onItemAcquired(item: UnlockableComponent): void {
    const cost = item.getCost()
    const xpGained = cost * XP_PER_DOLLAR
    
    this.addXP(xpGained)
  }

  /**
   * Add XP and check for level changes
   */
  public static addXP(amount: number): void {
    if (amount <= 0) return

    this.totalXP += amount
    const newLevel = this.calculateLevelFromXP(this.totalXP)

    if (newLevel !== this.currentLevel) {
      const oldLevel = this.currentLevel
      this.currentLevel = newLevel
      this.notifyLevelChange(oldLevel, newLevel)
    }
  }

  /**
   * Calculate level from total XP using thresholds
   */
  private static calculateLevelFromXP(xp: number): number {
    let level = 1
    for (let i = 0; i < this.levelThresholds.length; i++) {
      if (xp >= this.levelThresholds[i]) {
        level = i + 1
      } else {
        break
      }
    }
    return level
  }

  /**
   * Notify all listeners of a level change
   */
  private static notifyLevelChange(oldLevel: number, newLevel: number): void {
    console.log(`Level up! ${oldLevel} -> ${newLevel}`)
    
    for (const listener of this.levelChangeListeners) {
      try {
        listener(oldLevel, newLevel)
      } catch (error) {
        console.error("Level change listener error:", error)
      }
    }
  }

  /**
   * Add a listener for level changes
   */
  public static addLevelChangeListener(callback: (oldLevel: number, newLevel: number) => void): void {
    this.levelChangeListeners.push(callback)
  }

  /**
   * Remove a level change listener
   */
  public static removeLevelChangeListener(callback: (oldLevel: number, newLevel: number) => void): void {
    const index = this.levelChangeListeners.indexOf(callback)
    if (index >= 0) {
      this.levelChangeListeners.splice(index, 1)
    }
  }

  /**
   * Get current level
   */
  public static getLevel(): number {
    return this.currentLevel
  }

  /**
   * Get total XP
   */
  public static getXP(): number {
    return this.totalXP
  }

  /**
   * Get XP needed to reach next level
   */
  public static getXPToNextLevel(): number {
    if (this.currentLevel >= this.levelThresholds.length) {
      return 0 // Max level reached
    }
    return this.levelThresholds[this.currentLevel] - this.totalXP
  }

  /**
   * Get XP threshold for next level
   */
  public static getNextLevelThreshold(): number {
    if (this.currentLevel >= this.levelThresholds.length) {
      return this.totalXP // Already at max
    }
    return this.levelThresholds[this.currentLevel]
  }

  /**
   * Get XP threshold for current level
   */
  public static getCurrentLevelThreshold(): number {
    return this.levelThresholds[this.currentLevel - 1] || 0
  }

  /**
   * Check if at max level
   */
  public static isMaxLevel(): boolean {
    return this.currentLevel >= this.levelThresholds.length
  }

  /**
   * Get debug info
   */
  public static getDebugInfo(): object {
    return {
      level: this.currentLevel,
      totalXP: this.totalXP,
      xpToNextLevel: this.getXPToNextLevel(),
      nextLevelThreshold: this.getNextLevelThreshold(),
      currentLevelThreshold: this.getCurrentLevelThreshold(),
      isMaxLevel: this.isMaxLevel(),
      listenerCount: this.levelChangeListeners.length,
    }
  }

  /**
   * Reset the leveling system (for testing)
   */
  public static reset(): void {
    this.totalXP = 0
    this.currentLevel = 1
    this.isInitialized = false
    this.levelChangeListeners = []
  }
}

