// Import dependencies for updating static values
import { PlayerInventory, PlayerComponent } from "@game"
import { MoneyPile, CostManager } from "@game/money"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import {
  PLAYER_INVENTORY_SIZES,
  PLAYER_SPEEDS,
  PLAYER_PROFIT_MULTIPLIERS,
} from "../BurgerShopBalanceConfig"

/**
 * Manager for tracking upgrade levels and costs - Three.js version
 * Must call initialize() before use to load saved data
 */
export class UpgradeManager {
  private static readonly STORAGE_KEY = "burger_shop_upgrades"
  private static INSTANCE?: UpgradeManager

  // Current upgrade levels
  private inventoryLevel: number = 0
  private speedLevel: number = 0
  private profitLevel: number = 0

  private temporarySpeedBoost: boolean = false
  private temporaryInventoryBoost: boolean = false

  constructor() {
    // Public constructor - call initialize() after creating
  }

  /**
   * Initialize the manager by loading saved data from storage
   * Must be called before using the manager
   */
  public async initialize(): Promise<void> {
    UpgradeManager.INSTANCE = this

    try {
      const saved = await RundotGameAPI.appStorage.getItem(UpgradeManager.STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.inventoryLevel = data.inventory || 0
        this.speedLevel = data.speed || 0
        this.profitLevel = data.profit || 0
      }
      // Always update static values after loading (or when no data exists)
      this.updateStaticValues()
    } catch (error) {
      console.warn("Failed to load upgrades:", error)
      // Still apply defaults on error
      this.updateStaticValues()
    }
  }

  // ===========================================
  // PUBLIC API - Upgrade Actions
  // ===========================================
  
  public upgradeInventory(): void {
    if (this.canUpgradeInventory()) {
      this.inventoryLevel++
      this.updateStaticValues()
      this.saveToStorage()
      
      // Track upgrade event
      RundotGameAPI.analytics.recordCustomEvent("Upgrade", {
        type: "inventory",
        level: this.inventoryLevel
      })
    }
  }

  public upgradeSpeed(): void {
    if (this.canUpgradeSpeed()) {
      this.speedLevel++
      this.updateStaticValues()
      this.saveToStorage()
      
      // Track upgrade event
      RundotGameAPI.analytics.recordCustomEvent("Upgrade", {
        type: "speed",
        level: this.speedLevel
      })
    }
  }

  public upgradeProfit(): void {
    if (this.canUpgradeProfit()) {
      this.profitLevel++
      this.updateStaticValues()
      this.saveToStorage()
      
      // Track upgrade event
      RundotGameAPI.analytics.recordCustomEvent("Upgrade", {
        type: "profit",
        level: this.profitLevel
      })
    }
  }

  // ===========================================
  // PUBLIC API - Current Values
  // ===========================================

  public getInventoryLevel(): number {
    return this.inventoryLevel
  }

  public getSpeedLevel(): number {
    return this.speedLevel
  }

  public getProfitLevel(): number {
    return this.profitLevel
  }

  public getInventorySize(): number {
    if (this.temporaryInventoryBoost) {
      return PLAYER_INVENTORY_SIZES[PLAYER_INVENTORY_SIZES.length - 1] + 2
    }

    return PLAYER_INVENTORY_SIZES[this.inventoryLevel]
  }

  public getSpeed(): number {
    if (this.temporarySpeedBoost) {
      return PLAYER_SPEEDS[PLAYER_SPEEDS.length - 1] * 1.3
    }

    return PLAYER_SPEEDS[this.speedLevel]
  }

  public getProfitMultiplier(): number {
    return PLAYER_PROFIT_MULTIPLIERS[this.profitLevel]
  }

  // ===========================================
  // PUBLIC API - Upgrade Info
  // ===========================================

  public canUpgradeInventory(): boolean {
    return this.inventoryLevel < PLAYER_INVENTORY_SIZES.length - 1
  }

  public canUpgradeSpeed(): boolean {
    return this.speedLevel < PLAYER_SPEEDS.length - 1
  }

  public canUpgradeProfit(): boolean {
    return this.profitLevel < PLAYER_PROFIT_MULTIPLIERS.length - 1
  }

  public getInventoryCost(): number {
    return this.canUpgradeInventory() ? CostManager.getCost(`upgrade_inventory_${this.inventoryLevel + 1}`) : 0
  }

  public getSpeedCost(): number {
    return this.canUpgradeSpeed() ? CostManager.getCost(`upgrade_speed_${this.speedLevel + 1}`) : 0
  }

  public getProfitCost(): number {
    return this.canUpgradeProfit() ? CostManager.getCost(`upgrade_profit_${this.profitLevel + 1}`) : 0
  }

  // ===========================================
  // STATIC UTILITIES
  // ===========================================

  public static async clearStorage(): Promise<void> {
    try {
      // Reset all levels to 0 and save to RundotGameAPI storage
      const resetData = { inventory: 0, speed: 0, profit: 0 }
      await RundotGameAPI.appStorage.setItem(UpgradeManager.STORAGE_KEY, JSON.stringify(resetData))
      
      // Use actual configuration table values for level 0
      PlayerInventory.maxInventorySize = PLAYER_INVENTORY_SIZES[0]
      PlayerComponent.speed = PLAYER_SPEEDS[0] 
      MoneyPile.profitMultiplier = PLAYER_PROFIT_MULTIPLIERS[0]
    } catch (error) {
      console.warn("Failed to clear upgrade storage:", error)
    }
  }

  public static setSpeedBoost(boost: boolean): void {
    if (UpgradeManager.INSTANCE) {
      UpgradeManager.INSTANCE.temporarySpeedBoost = boost
      UpgradeManager.INSTANCE.updateStaticValues()
    }
  }

  public static setInventoryBoost(boost: boolean): void {
    if (UpgradeManager.INSTANCE) {
      UpgradeManager.INSTANCE.temporaryInventoryBoost = boost
      UpgradeManager.INSTANCE.updateStaticValues()
    }
  }

  public static getSpeedBoostIncrease(): number {
    if (UpgradeManager.INSTANCE) {
      return Math.floor((PLAYER_SPEEDS[PLAYER_SPEEDS.length - 1] * 1.3 / PLAYER_SPEEDS[UpgradeManager.INSTANCE.speedLevel]) * 100)
    }
    return PLAYER_SPEEDS[0]
  }

  public static getInventoryBoostIncrease(): number {
    if (UpgradeManager.INSTANCE) {
      return Math.floor(((PLAYER_INVENTORY_SIZES[PLAYER_INVENTORY_SIZES.length - 1] + 2) / PLAYER_INVENTORY_SIZES[UpgradeManager.INSTANCE.inventoryLevel]) * 100)
    }
    return PLAYER_INVENTORY_SIZES[0]
  }

  // ===========================================
  // PRIVATE METHODS
  // ===========================================

  private updateStaticValues(): void {
    PlayerInventory.maxInventorySize = this.getInventorySize()
    PlayerComponent.speed = this.getSpeed()
    MoneyPile.profitMultiplier = this.getProfitMultiplier()
  }

  private saveToStorage(): void {
    try {
      const data = {
        inventory: this.inventoryLevel,
        speed: this.speedLevel,
        profit: this.profitLevel,
      }
      // Save to RundotGameAPI storage (async fire-and-forget)
      RundotGameAPI.appStorage.setItem(UpgradeManager.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn("Failed to save upgrades:", error)
    }
  }
}
