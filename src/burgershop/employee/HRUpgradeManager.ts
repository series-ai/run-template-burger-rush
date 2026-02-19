import { CostManager } from "@game/money"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { EmployeeInventory } from "./EmployeeInventory"
import { Employee } from "./Employee"
import {
  EMPLOYEE_MAX_COUNT,
  EMPLOYEE_SPEEDS,
  EMPLOYEE_INVENTORY_SIZES,
} from "../BurgerShopBalanceConfig"

/**
 * Three.js HR Upgrade Manager
 * Tracks hireable employees, employee speed level, and inventory level.
 * Persists state using RundotGameAPI.appStorage.
 * Applies gameplay effects through static class properties.
 * Must call initialize() before use to load saved data.
 */
export class HRUpgradeManager {
  private static readonly STORAGE_KEY = "burger_shop_hr_upgrades_three"

  // State
  private employeeCountLevel: number = 0
  private employeeSpeedLevel: number = 0
  private employeeInventoryLevel: number = 0

  constructor() {
    // Public constructor - call initialize() after creating
  }

  /**
   * Initialize the manager by loading saved data from storage
   * Must be called before using the manager
   */
  public async initialize(): Promise<void> {
    try {
      const raw = await RundotGameAPI.appStorage.getItem(HRUpgradeManager.STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        this.employeeCountLevel = Number.isFinite(data.employeeCount) ? data.employeeCount : 0
        this.employeeSpeedLevel = Number.isFinite(data.employeeSpeedLevel) ? data.employeeSpeedLevel : 0
        this.employeeInventoryLevel = Number.isFinite(data.employeeInventoryLevel) ? data.employeeInventoryLevel : 0
      }
      // Always update static values after loading (or when no data exists)
      this.updateStaticValues()
    } catch (error) {
      console.warn("Failed to load HR upgrades:", error)
      // Still apply defaults on error
      this.updateStaticValues()
    }
  }

  /**
   * Update static class properties based on current upgrade levels
   */
  private updateStaticValues(): void {
    EmployeeInventory.maxInventorySize = this.getEmployeeInventorySize()
    Employee.speed = this.getEmployeeSpeed()
  }

  private saveToStorage(): void {
    try {
      const data = {
        employeeCount: this.employeeCountLevel,
        employeeSpeedLevel: this.employeeSpeedLevel,
        employeeInventoryLevel: this.employeeInventoryLevel,
      }
      // Save to RundotGameAPI storage (async, but don't await)
      RundotGameAPI.appStorage.setItem(
        HRUpgradeManager.STORAGE_KEY,
        JSON.stringify(data),
      )
    } catch (_) {
      // Ignore
    }
  }

  // Employees
  public getEmployeeCount(): number {
    return this.employeeCountLevel
  }
  public getMaxEmployees(): number {
    return EMPLOYEE_MAX_COUNT
  }
  public canPurchaseEmployee(): boolean {
    return this.employeeCountLevel < EMPLOYEE_MAX_COUNT
  }
  public getEmployeeCost(): number {
    return this.canPurchaseEmployee()
      ? CostManager.getCost(`employee_${this.employeeCountLevel + 1}`)
      : 0
  }
  public async purchaseEmployee(): Promise<boolean> {
    if (!this.canPurchaseEmployee()) return false
    this.employeeCountLevel += 1
    this.saveToStorage()
    
    // Track HR upgrade event
    RundotGameAPI.analytics.recordCustomEvent("HR Upgrade", {
      type: "count",
      level: this.employeeCountLevel
    })
    
    return true
  }

  // Speed
  public getEmployeeSpeedLevel(): number {
    return this.employeeSpeedLevel
  }
  public getEmployeeSpeed(): number {
    return EMPLOYEE_SPEEDS[this.employeeSpeedLevel]
  }
  public canUpgradeEmployeeSpeed(): boolean {
    return this.employeeSpeedLevel < EMPLOYEE_SPEEDS.length - 1
  }
  public getEmployeeSpeedCost(): number {
    return this.canUpgradeEmployeeSpeed()
      ? CostManager.getCost(`employee_speed_${this.employeeSpeedLevel + 1}`)
      : 0
  }
  public async upgradeEmployeeSpeed(): Promise<boolean> {
    if (!this.canUpgradeEmployeeSpeed()) return false
    this.employeeSpeedLevel += 1
    this.saveToStorage()
    
    // Track HR upgrade event
    RundotGameAPI.analytics.recordCustomEvent("HR Upgrade", {
      type: "speed",
      level: this.employeeSpeedLevel
    })
    
    return true
  }

  // Inventory
  public getEmployeeInventoryLevel(): number {
    return this.employeeInventoryLevel
  }
  public getEmployeeInventorySize(): number {
    return EMPLOYEE_INVENTORY_SIZES[this.employeeInventoryLevel]
  }
  public canUpgradeEmployeeInventory(): boolean {
    return this.employeeInventoryLevel < EMPLOYEE_INVENTORY_SIZES.length - 1
  }
  public getEmployeeInventoryCost(): number {
    return this.canUpgradeEmployeeInventory()
      ? CostManager.getCost(`employee_inventory_${this.employeeInventoryLevel + 1}`)
      : 0
  }
  public async upgradeEmployeeInventory(): Promise<boolean> {
    if (!this.canUpgradeEmployeeInventory()) return false
    this.employeeInventoryLevel += 1
    this.saveToStorage()
    
    // Track HR upgrade event
    RundotGameAPI.analytics.recordCustomEvent("HR Upgrade", {
      type: "inventory",
      level: this.employeeInventoryLevel
    })
    
    return true
  }

  // Debug helpers
  public static async debugClearAll(): Promise<void> {
    try {
      await RundotGameAPI.appStorage.removeItem(HRUpgradeManager.STORAGE_KEY)
    } catch {}
    
    // Reset Employee static values to defaults (level 0)
    const { EmployeeInventory } = await import("./EmployeeInventory")
    const { Employee } = await import("./Employee")
    EmployeeInventory.maxInventorySize = EMPLOYEE_INVENTORY_SIZES[0]
    Employee.speed = EMPLOYEE_SPEEDS[0]
  }
}
