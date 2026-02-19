import { BurgerShopDirectory } from "@game/BurgerShopDirectory"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

/**
 * Tracks game events for tutorial conditions
 * Provides a centralized way to monitor player actions
 * Handles persistence of completed tutorial steps
 */
export class TutorialTracker {
  private static instance: TutorialTracker | null = null
  private static readonly STORAGE_KEY_COMPLETED = "burger_shop_tutorial_completed"

  // Game event tracking
  private burgersPickedUp: number = 0
  private burgersDeliveredToCheckout: number = 0
  private customersServed: number = 0
  private trashAcquiredTime: number = -1
  private lastUpdateTime: number = 0
  
  // Table cleaning tracking
  private firstDirtyTableTime: number = -1
  private trashPickedUpFromTables: number = 0
  private trashDisposedInTrashCan: number = 0
  private firstTrashPickupTime: number = -1
  private shopPurchasedTime: number = -1
  private firstBurgerDeliveryTime: number = -1

  private allTutorialSteps: string[] = []
  // Completed tutorial steps (persisted)
  private completedSteps: Set<string> = new Set()

  private constructor() {
    // Initialize with current time
    this.lastUpdateTime = performance.now() / 1000
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TutorialTracker {
    if (!this.instance) {
      this.instance = new TutorialTracker()
    }
    return this.instance
  }

  /**
   * Initialize the tracker - load completed steps from storage
   * Call this during game initialization (in parallel with other systems)
   */
  public static async initialize(): Promise<void> {
    const instance = this.getInstance()
    await instance.loadCompletedSteps()
  }

  /**
   * Update the tracker (call each frame)
   */
  public update(): void {
    this.lastUpdateTime = performance.now() / 1000
  }

  /**
   * Initialize all tutorial steps
   */
  public initAllTutorialSteps(steps: string[]): void {
    this.allTutorialSteps = steps
  }

  /**
   * Record that a burger was picked up from burger station
   */
  public recordBurgerPickup(): void {
    this.burgersPickedUp++
  }

  /**
   * Record that a burger was delivered to checkout
   */
  public recordBurgerDelivery(): void {
    this.burgersDeliveredToCheckout++
    
    // Record time of first burger delivery
    if (this.firstBurgerDeliveryTime < 0) {
      this.firstBurgerDeliveryTime = this.lastUpdateTime
    }
  }

  /**
   * Record that a customer was served
   */
  public recordCustomerServed(): void {
    this.customersServed++
  }

  /**
   * Record when trash was acquired (purchased)
   */
  public recordTrashAcquired(): void {
    if (this.trashAcquiredTime < 0) {
      this.trashAcquiredTime = this.lastUpdateTime
    }
  }

  /**
   * Get time elapsed since trash was acquired (-1 if not acquired)
   */
  public getTimeSinceTrashAcquired(): number {
    return this.trashAcquiredTime >= 0 ? this.lastUpdateTime - this.trashAcquiredTime : -1
  }

  /**
   * Get number of burgers picked up
   */
  public getBurgersPickedUp(): number {
    return this.burgersPickedUp
  }

  /**
   * Get number of burgers delivered to checkout
   */
  public getBurgersDeliveredToCheckout(): number {
    return this.burgersDeliveredToCheckout
  }

  /**
   * Get number of customers served
   */
  public getCustomersServed(): number {
    return this.customersServed
  }

  /**
   * Record when first dirty table appears
   */
  public recordFirstDirtyTable(): void {
    if (this.firstDirtyTableTime < 0) {
      this.firstDirtyTableTime = this.lastUpdateTime
    }
  }

  /**
   * Record when trash is picked up from a table
   */
  public recordTrashPickupFromTable(): void {
    this.trashPickedUpFromTables++
    
    // Record time of first trash pickup
    if (this.firstTrashPickupTime < 0) {
      this.firstTrashPickupTime = this.lastUpdateTime
    }
  }

  /**
   * Record when trash is disposed in trash can
   */
  public recordTrashDisposed(): void {
    this.trashDisposedInTrashCan++
  }

  /**
   * Get time elapsed since first dirty table appeared (-1 if none)
   */
  public getTimeSinceFirstDirtyTable(): number {
    return this.firstDirtyTableTime >= 0 ? this.lastUpdateTime - this.firstDirtyTableTime : -1
  }

  /**
   * Get number of trash items picked up from tables
   */
  public getTrashPickedUpFromTables(): number {
    return this.trashPickedUpFromTables
  }

  /**
   * Get number of trash items disposed in trash can
   */
  public getTrashDisposedInTrashCan(): number {
    return this.trashDisposedInTrashCan
  }

  /**
   * Check if there are any dirty tables currently
   */
  public hasDirtyTables(): boolean {
    // Use the directory to check if any tables have trash
    return BurgerShopDirectory.findTableWithTrash() !== null
  }

  /**
   * Check if any table is occupied (customers eating or dirty/needs cleaning)
   */
  public hasOccupiedTables(): boolean {
    return BurgerShopDirectory.findOccupiedTable() !== null
  }

  /**
   * Get time elapsed since first trash pickup (-1 if none)
   */
  public getTimeSinceFirstTrashPickup(): number {
    return this.firstTrashPickupTime >= 0 ? this.lastUpdateTime - this.firstTrashPickupTime : -1
  }

  /**
   * Record when shop was purchased
   */
  public recordShopPurchased(): void {
    if (this.shopPurchasedTime < 0) {
      this.shopPurchasedTime = this.lastUpdateTime
    }
  }

  /**
   * Get time elapsed since shop was purchased (-1 if not purchased)
   */
  public getTimeSinceShopPurchased(): number {
    return this.shopPurchasedTime >= 0 ? this.lastUpdateTime - this.shopPurchasedTime : -1
  }

  /**
   * Get time elapsed since first burger delivery (-1 if none)
   */
  public getTimeSinceFirstBurgerDelivery(): number {
    return this.firstBurgerDeliveryTime >= 0 ? this.lastUpdateTime - this.firstBurgerDeliveryTime : -1
  }

  /**
   * Load completed steps from storage
   */
  private async loadCompletedSteps(): Promise<void> {
    try {
      const savedCompleted = await RundotGameAPI.appStorage.getItem(
        TutorialTracker.STORAGE_KEY_COMPLETED
      )
      if (savedCompleted) {
        const completedArray: string[] = JSON.parse(savedCompleted)
        this.completedSteps = new Set(completedArray)
        console.log(`🎯 Loaded ${this.completedSteps.size} completed tutorial steps`)
      }
    } catch (error) {
      console.error("❌ Failed to load completed tutorial steps:", error)
    }
  }

  /**
   * Save completed steps to storage
   */
  public async saveCompletedSteps(): Promise<void> {
    try {
      const completedArray = Array.from(this.completedSteps)
      const jsonString = JSON.stringify(completedArray)
      await RundotGameAPI.appStorage.setItem(
        TutorialTracker.STORAGE_KEY_COMPLETED,
        jsonString
      )
    } catch (error) {
      console.error("❌ Failed to save tutorial steps:", error)
      throw error
    }
  }

  /**
   * Mark a tutorial step as completed
   */
  public completeStep(stepId: string): void {
    if (!this.completedSteps.has(stepId)) {
      this.completedSteps.add(stepId)
      // Save asynchronously (fire and forget for performance)
      this.saveCompletedSteps().catch(err => 
        console.error("Failed to save completed step:", err)
      )
    }
  }

  /**
   * Check if a tutorial step is completed
   */
  public isStepCompleted(stepId: string): boolean {
    return this.completedSteps.has(stepId)
  }

  /**
   * Get all completed step IDs
   */
  public getCompletedSteps(): Set<string> {
    return new Set(this.completedSteps) // Return a copy
  }

  /**
   * Check if the tutorial is completed
   */
  public isTutorialCompleted(): boolean {
    return this.completedSteps.size >= this.allTutorialSteps.length
  }

  /**
   * Reset all tracking (for testing/debugging)
   */
  public async reset(): Promise<void> {
    this.burgersPickedUp = 0
    this.burgersDeliveredToCheckout = 0
    this.customersServed = 0
    this.trashAcquiredTime = -1
    this.lastUpdateTime = performance.now() / 1000
    
    this.firstDirtyTableTime = -1
    this.trashPickedUpFromTables = 0
    this.trashDisposedInTrashCan = 0
    this.firstTrashPickupTime = -1
    this.shopPurchasedTime = -1
    this.firstBurgerDeliveryTime = -1
    
    // Reset completed steps
    this.completedSteps.clear()
    await this.saveCompletedSteps()
  }

  /**
   * Get debug info
   */
  public getDebugInfo(): any {
    return {
      completedSteps: Array.from(this.completedSteps),
      burgersPickedUp: this.burgersPickedUp,
      burgersDeliveredToCheckout: this.burgersDeliveredToCheckout,
      customersServed: this.customersServed,
      trashAcquiredTime: this.trashAcquiredTime,
      currentTime: this.lastUpdateTime,
      timeSinceTrash: this.trashAcquiredTime >= 0 ? this.lastUpdateTime - this.trashAcquiredTime : -1,
      firstDirtyTableTime: this.firstDirtyTableTime,
      timeSinceFirstDirtyTable: this.firstDirtyTableTime >= 0 ? this.lastUpdateTime - this.firstDirtyTableTime : -1,
      trashPickedUpFromTables: this.trashPickedUpFromTables,
      trashDisposedInTrashCan: this.trashDisposedInTrashCan,
      hasDirtyTables: this.hasDirtyTables(),
      firstTrashPickupTime: this.firstTrashPickupTime,
      timeSinceFirstTrashPickup: this.firstTrashPickupTime >= 0 ? this.lastUpdateTime - this.firstTrashPickupTime : -1,
      shopPurchasedTime: this.shopPurchasedTime,
      timeSinceShopPurchased: this.shopPurchasedTime >= 0 ? this.lastUpdateTime - this.shopPurchasedTime : -1,
      firstBurgerDeliveryTime: this.firstBurgerDeliveryTime,
      timeSinceFirstBurgerDelivery: this.firstBurgerDeliveryTime >= 0 ? this.lastUpdateTime - this.firstBurgerDeliveryTime : -1
    }
  }
}
