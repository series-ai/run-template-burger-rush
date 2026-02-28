import * as THREE from "three"
import { IUnlockable } from "./IUnlockable"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { MoneySystem } from "./MoneySystem"
import {
  PlayAudioOneShot2D,
  Main2DAudioBank,
  StowKitSystem,
  ParticleSystemPrefabComponent,
  PrefabLoader,
} from "@series-inc/rundot-3d-engine/systems"

// Type constraint: must be a Component that implements IUnlockable
export type UnlockableComponent = Component & IUnlockable

// Venus API type definition

/**
 * Three.js version of UnlockManager for managing unlock dependencies and states
 * Uses GameObject IDs as keys and handles dependency registration
 * Integrates with Venus API for persistent storage
 */
export class UnlockManager {
  // Track registered unlockable objects by GameObject ID
  private static unlockables: Map<string, UnlockableComponent> = new Map()

  // Track what's unlocked (available for purchase) by GameObject ID
  private static unlockedItems: Set<string> = new Set()

  // Track what's acquired (purchased/built) by GameObject ID
  private static acquiredItems: Set<string> = new Set()

  // Dependency definitions - what requires what to be acquired
  private static dependencies: Map<string, string[]> = new Map()  

  // Track registration order for funnel step tracking
  private static registrationOrder: number = 0
  private static itemRegistrationOrder: Map<string, number> = new Map()

  // Track initialization state
  private static isInitialized: boolean = false

  // Event listeners for acquisition events
  private static onAcquireListeners: ((
    acquiredItem: UnlockableComponent,
    newlyUnlocked: UnlockableComponent[],
  ) => void)[] = []

  // Event listeners for unlock events
  private static onUnlockListeners: ((
    unlockedItem: UnlockableComponent,
  ) => void)[] = []

  // Storage keys for Venus API
  private static readonly STORAGE_KEY_UNLOCKED =
    "burger_shop_unlocked_items_three"
  private static readonly STORAGE_KEY_ACQUIRED =
    "burger_shop_acquired_items_three"

  /**
   * Initialize the UnlockManager with Venus API storage
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("⚠️ UnlockManager already initialized!")
      return
    }

    try {
      // Load state from Venus API storage (parallel for faster startup)
      await Promise.all([
        this.loadUnlockedItems(),
        this.loadAcquiredItems()
      ])

      this.isInitialized = true
      // UnlockManager initialized
    } catch (error) {
      console.error("❌ Failed to initialize UnlockManager:", error)
      this.isInitialized = true // Continue anyway with empty state
    }
  }

  /**
   * Load unlocked items from Venus API storage
   */
  private static async loadUnlockedItems(): Promise<void> {
    const savedUnlocked = await RundotGameAPI.appStorage.getItem(
      this.STORAGE_KEY_UNLOCKED,
    )

    if (savedUnlocked) {
      const unlockedArray = JSON.parse(savedUnlocked)
      this.unlockedItems = new Set(unlockedArray)
    } else {
      console.log(`🔓 No unlocked items found in storage`)
    }
  }

  /**
   * Load acquired items from Venus API storage
   */
  private static async loadAcquiredItems(): Promise<void> {
    const savedAcquired = await RundotGameAPI.appStorage.getItem(
      this.STORAGE_KEY_ACQUIRED,
    )

    if (savedAcquired) {
      const acquiredArray = JSON.parse(savedAcquired)
      this.acquiredItems = new Set(acquiredArray)
      // Acquired items loaded
    } else {
      RundotGameAPI.log(`✅ No acquired items found in storage`)
    }
  }

  /**
   * Save unlocked items to Venus API storage
   */
  private static async saveUnlockedItems(): Promise<void> {
    const unlockedArray = Array.from(this.unlockedItems)
    try {
      await UnlockManager.saveString(
        this.STORAGE_KEY_UNLOCKED,
        JSON.stringify(unlockedArray),
      )
    } catch (error) {
      console.error("❌ Failed to save unlocked items:", error)
    }
  }

  /**
   * Save acquired items to Venus API storage
   */
  private static async saveAcquiredItems(): Promise<void> {
    try {
      const acquiredArray = Array.from(this.acquiredItems)
      await UnlockManager.saveString(
        this.STORAGE_KEY_ACQUIRED,
        JSON.stringify(acquiredArray),
      )
    } catch (error) {
      console.error("❌ Failed to save acquired items:", error)
    }
  }

  private static async saveString(key: string, value: string) {
    await RundotGameAPI.appStorage.setItem(key, value)
  }

  private static async delete(key: string): Promise<void> {
    await RundotGameAPI.appStorage.removeItem(key)
  }

  /**
   * Register an unlockable component with its dependencies
   */
  public static register(
    unlockable: UnlockableComponent,
    dependencies: UnlockableComponent[] = [],
  ): void {
    if (!this.isInitialized) {
      console.warn("⚠️ UnlockManager not initialized! Call initialize() first.")
      return
    }

    const id = unlockable.getUnlockableId()
    const depIds = dependencies.map((dep) => dep.getUnlockableId())
    
    // Track registration order for funnel step tracking
    this.registrationOrder++
    this.itemRegistrationOrder.set(id, this.registrationOrder)

    this.unlockables.set(id, unlockable)
    this.dependencies.set(id, depIds)

    // Registering unlockable with dependencies

    // Check if this was previously unlocked/acquired and restore state
    if (this.unlockedItems.has(id)) {
      unlockable.unlock()
      // Unlocked state restored
    }

    if (this.acquiredItems.has(id)) {
      unlockable.acquire(true) // Pass true to indicate loading from storage (skip animations)
      // Acquired state restored
    }

    // Check if this should be unlocked immediately (based on dependencies)
    if (!this.unlockedItems.has(id) && this.canUnlock(id)) {
      console.log(
        `🔑 Auto-unlocking ${unlockable.getDisplayName()} (no unmet dependencies)`,
      )
      this.unlockItem(id)
    } else if (!this.unlockedItems.has(id)) {
      console.log(
        `🔒 ${unlockable.getDisplayName()} stays locked (dependencies not met)`,
      )
    }
  }

  /**
   * Mark an item as acquired (purchased/built) and check for new unlocks
   */
  public static acquire(unlockable: UnlockableComponent): void {
    if (!this.isInitialized) {
      console.warn("⚠️ UnlockManager not initialized! Call initialize() first.")
      return
    }

    const id = unlockable.getUnlockableId()

    if (this.acquiredItems.has(id)) {
      return // Already acquired
    }
    
    // RundotGameAPI.analytics.recordCustomEvent("Unlock " + id, {
    //   payload: {
    //     prop1: "some prop"
    //   }
    // })

    // Use registration order for funnel step tracking
    const stepOrder = (this.itemRegistrationOrder.get(id) || 1) + 2
    console.log("Tracking funnel step:", stepOrder, id)
    RundotGameAPI.analytics.trackFunnelStep(stepOrder, id)

    this.acquiredItems.add(id)
    // Item acquired

    // Play upgrade sound
    try {
      PlayAudioOneShot2D(Main2DAudioBank, "upgrade")
    } catch (error) {
      console.warn("Failed to play upgrade sound:", error)
    }

    // Spawn upgrade particle effect above the station
    this.spawnUpgradeEffect(unlockable)

    // Call acquire on the unlockable item
    unlockable.acquire()

    // Save to storage asynchronously (don't await to keep synchronous)
    this.saveAcquiredItems()

    // Check what can now be unlocked
    const newlyUnlocked = this.checkForNewUnlocks()

    // Notify listeners about the acquisition and any new unlocks
    this.onAcquireListeners.forEach((listener) => {
      try {
        listener(unlockable, newlyUnlocked)
      } catch (error) {
        console.error("❌ Unlock acquire listener failed:", error)
      }
    })
  }

  /**
   * Add listener for acquisition events
   */
  public static addAcquireListener(
    listener: (
      acquiredItem: UnlockableComponent,
      newlyUnlocked: UnlockableComponent[],
    ) => void,
  ): void {
    this.onAcquireListeners.push(listener)
  }

  /**
   * Remove listener for acquisition events
   */
  public static removeAcquireListener(
    listener: (
      acquiredItem: UnlockableComponent,
      newlyUnlocked: UnlockableComponent[],
    ) => void,
  ): void {
    const index = this.onAcquireListeners.indexOf(listener)
    if (index >= 0) {
      this.onAcquireListeners.splice(index, 1)
    }
  }

  /**
   * Add listener for unlock events
   */
  public static addUnlockListener(
    listener: (unlockedItem: UnlockableComponent) => void,
  ): void {
    this.onUnlockListeners.push(listener)
  }

  /**
   * Remove listener for unlock events
   */
  public static removeUnlockListener(
    listener: (unlockedItem: UnlockableComponent) => void,
  ): void {
    const index = this.onUnlockListeners.indexOf(listener)
    if (index >= 0) {
      this.onUnlockListeners.splice(index, 1)
    }
  }

  /**
   * Check if an item can be unlocked (all dependencies acquired)
   */
  private static canUnlock(itemId: string): boolean {
    const requiredIds = this.dependencies.get(itemId) || []
    return requiredIds.every((requiredId) => this.acquiredItems.has(requiredId))
  }

  /**
   * Unlock an item (make it available for purchase)
   */
  private static unlockItem(itemId: string): void {
    if (this.unlockedItems.has(itemId)) {
      return // Already unlocked
    }

    this.unlockedItems.add(itemId)

    // Save to storage asynchronously (don't await to keep synchronous)
    this.saveUnlockedItems()

    const unlockable = this.unlockables.get(itemId)
    if (unlockable) {
      unlockable.unlock()
      // Item unlocked

      // Play unlock sound
      try {
        PlayAudioOneShot2D(Main2DAudioBank, "unlock")
      } catch (error) {
        console.warn("Failed to play unlock sound:", error)
      }

      // Notify unlock listeners
      this.onUnlockListeners.forEach((listener) => {
        try {
          listener(unlockable)
        } catch (error) {
          console.error("❌ Unlock listener failed:", error)
        }
      })
    }
  }

  /**
   * Check for items that can now be unlocked after an acquisition
   * Returns array of newly unlocked items
   */
  private static checkForNewUnlocks(): UnlockableComponent[] {
    const newlyUnlocked: UnlockableComponent[] = []

    for (const [itemId, unlockable] of this.unlockables.entries()) {
      if (!this.unlockedItems.has(itemId) && this.canUnlock(itemId)) {
        this.unlockItem(itemId)
        newlyUnlocked.push(unlockable)
      }
    }

    return newlyUnlocked
  }

  /**
   * Check if an item is unlocked (available for purchase)
   */
  public static isUnlocked(unlockable: UnlockableComponent): boolean {
    return this.unlockedItems.has(unlockable.getUnlockableId())
  }

  /**
   * Check if an item is acquired (purchased/built)
   */
  public static isAcquired(unlockable: UnlockableComponent): boolean {
    return this.acquiredItems.has(unlockable.getUnlockableId())
  }

  /**
   * Get all unlocked items
   */
  public static getUnlockedItems(): string[] {
    return Array.from(this.unlockedItems)
  }

  /**
   * Get all acquired items
   */
  public static getAcquiredItems(): string[] {
    return Array.from(this.acquiredItems)
  }

  /**
   * Get all unlocked, but unacquired items
   */
  public static getActivePurchasables(): string[] {
    let output = "Unlocked Items: {";
    for (const unlocked of this.unlockedItems.entries()) {
      output += unlocked + ", "
    }
    output += "}, acquired items: {"
    for (const acquired of this.acquiredItems) {
      output += acquired + ", "
    }
    output += "}, filtered: {"

    for (const filtered in Array.from(this.unlockedItems).filter((unlockable) => !this.acquiredItems.has(unlockable))) {
      output += filtered + ", "
    }

    console.log(output)

    return Array.from(this.unlockedItems).filter((unlockable) => !this.acquiredItems.has(unlockable))
  }

  /**
   * Get an unlockable component by its ID
   */
  public static getUnlockableById(id: string): UnlockableComponent | undefined {
    return this.unlockables.get(id)
  }

  /**
   * Debug method to unlock all registered items for purchase
   */
  public static debugUnlockAll(): void {
    console.log("🔓 DEBUG: Unlocking all items for purchase")
    for (const [itemId, unlockable] of this.unlockables.entries()) {
      if (!this.unlockedItems.has(itemId)) {
        this.unlockItem(itemId)
      }
    }
  }

  /**
   * Debug method to acquire all unlocked items
   */
  public static debugAcquireAll(): void {
    console.log("✅ DEBUG: Auto-acquiring all unlocked items")
    const unlockedCopy = new Set(this.unlockedItems)
    for (const itemId of unlockedCopy) {
      const unlockable = this.unlockables.get(itemId)
      if (unlockable && !this.acquiredItems.has(itemId)) {
        this.acquire(unlockable)
      }
    }
  }

  /**
   * Reset all state (for testing)
   */
  public static reset(): void {
    this.unlockables.clear()
    this.unlockedItems.clear()
    this.acquiredItems.clear()
    this.dependencies.clear()
    this.registrationOrder = 0
    this.itemRegistrationOrder.clear()
    this.isInitialized = false
    console.log("🔄 UnlockManager state reset")
  }

  /**
   * Debug method to clear all progress and refresh page (like the old Babylon.js version)
   */
  public static async debugClearAll(): Promise<void> {
    console.log("🧹 DEBUG: Clearing all unlock states and refreshing page!")

    // Clear in-memory state
    this.unlockedItems.clear()
    this.acquiredItems.clear()

    // Clear storage (including unlock/acquire states and money data)
    try {
      // Clear unlock and acquire storage
      await UnlockManager.delete(this.STORAGE_KEY_UNLOCKED)
      await UnlockManager.delete(this.STORAGE_KEY_ACQUIRED)
      console.log("🔓 DEBUG: Cleared unlock/acquire storage data")

      // Clear money storage so it starts fresh with default
      await UnlockManager.delete("burger_shop_money")
      console.log("💰 DEBUG: Cleared money storage data")

      // Clear upgrade systems (both global upgrade station and HR upgrades)
      await UnlockManager.delete("burger_shop_upgrades")
      await UnlockManager.delete("burger_shop_hr_upgrades_three")
      console.log("🧰 DEBUG: Cleared upgrade storage data from RundotGameAPI.appStorage")

      // Clear all purchase area progress
      await this.clearAllPurchaseProgress()

      // Clear all station level progress (grill upgrades, etc.)
      await this.clearAllStationLevelProgress()
      console.log("⬆️ DEBUG: Cleared station level storage data")

      // Reset money to default for immediate feedback
      const defaultMoney = MoneySystem.getDefaultMoney()
      MoneySystem.setMoney(defaultMoney)
      console.log(`💰 DEBUG: Money reset to default ($${defaultMoney})`)
    } catch (error) {
      console.log("💰 DEBUG: Could not clear storage or reset money:", error)
    }

    console.log(
      "✅ DEBUG: All states cleared (including storage and purchase progress)",
    )
    console.log("🔄 DEBUG: Page will refresh after all clears complete...")
  }

  private static async deleteAllItemsWhere(
    predicate: (key: string) => boolean,
  ) {
    const items = await RundotGameAPI.appStorage.length()
    for (let i = 0; i < items; i++) {
      const key = await RundotGameAPI.appStorage.key(i)
      if (key && predicate(key)) {
        await RundotGameAPI.appStorage.removeItem(key)
      }
    }
  }

  /**
   * Clear all purchase area progress from storage
   */
  private static async clearAllPurchaseProgress(): Promise<void> {
    const purchaseProgressPrefix = "burger_shop_purchase_progress_"

    await UnlockManager.deleteAllItemsWhere((key) => {
      return key.startsWith(purchaseProgressPrefix)
    })
  }

  /**
   * Clear all station level progress from storage (grill upgrades, etc.)
   */
  private static async clearAllStationLevelProgress(): Promise<void> {
    await UnlockManager.deleteAllItemsWhere((key) => {
      // Match keys like "grill_level_BurgerStation1" or any "*_level_*" pattern
      return key.includes("_level_")
    })
  }

  /**
   * Debug method to give money for testing
   */
  public static debugGiveMoney(amount: number): void {
    try {
      MoneySystem.addMoney(amount)
      console.log(`💰 DEBUG: Added $${amount} for testing`)
    } catch (error) {
      console.error("❌ DEBUG: Failed to give money:", error)
    }
  }

  /**
   * Get debug information
   */
  public static getDebugInfo(): any {
    return {
      unlockablesCount: this.unlockables.size,
      unlockedCount: this.unlockedItems.size,
      acquiredCount: this.acquiredItems.size,
      dependenciesCount: this.dependencies.size,
      isInitialized: this.isInitialized,
      registrationOrder: this.registrationOrder,
      unlockables: Array.from(this.unlockables.entries()).map(([id, comp]) => ({
        id,
        name: comp.getDisplayName(),
        cost: comp.getCost(),
        registrationStep: this.itemRegistrationOrder.get(id) || 0,
      })),
      unlocked: Array.from(this.unlockedItems),
      acquired: Array.from(this.acquiredItems),
      itemRegistrationOrder: Object.fromEntries(this.itemRegistrationOrder),
    }
  }

  /**
   * Spawn the upgrade particle effect above a station when it's acquired
   */
  private static spawnUpgradeEffect(unlockable: UnlockableComponent): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const upgradePrefab = prefabCollection.getPrefabByName("pfx_table_station_first_purchase")

    if (!upgradePrefab) {
      console.warn("pfx_table_station_first_purchase prefab not found")
      return
    }

    const stationGameObject = unlockable.getGameObject()
    if (!stationGameObject) return

    // Create a temporary holder positioned 2 meters above the station
    const effectHolder = new GameObject("UpgradeEffectHolder")
    const stationWorldPos = new THREE.Vector3()
    stationGameObject.getWorldPosition(stationWorldPos)
    effectHolder.position.copy(stationWorldPos)
    effectHolder.position.y += 2

    // Instantiate the prefab
    const instance = PrefabLoader.instantiatePrefab(upgradePrefab, effectHolder)
    const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

    if (particleComponent) {
      particleComponent.play()

      // Clean up the effect after 5 seconds (duration of the particle effect)
      setTimeout(() => {
        effectHolder.dispose()
      }, 5000)
    } else {
      effectHolder.dispose()
    }
  }
}
