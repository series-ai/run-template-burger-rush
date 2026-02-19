import * as THREE from "three"
import { GameObject } from "@series-inc/rundot-3d-engine"
import { CheckoutStation, ProductionStation } from "@game/shared"
import { Table } from "./Table"
import { TrashCan } from "./TrashCan"
import { TutorialSystemComponent } from "@game/tutorial"
import { Drivethru } from "@game/drivethru"
import { SelfCheckoutStation } from "@game/self-checkout"
import { BathroomStation } from "./bathroom-station/BathroomStation"
import { PlayerComponent } from "./PlayerComponent"
import { BurgerShopEnvironment } from "./BurgerShopEnvironment"
import { CameraManager } from "./camera"

/**
 * Simple directory service for finding active stations in Three.js version
 * This is a simplified version that tracks active stations
 */
export class BurgerShopDirectory {
  private static activeCheckoutStations: CheckoutStation[] = []
  private static activeSelfCheckoutStations: SelfCheckoutStation[] = []
  private static activeBurgerStations: ProductionStation[] = []
  private static activeTables: Table[] = []
  private static activeTrashCans: TrashCan[] = []
  private static activeDrivethrus: Drivethru[] = []
  private static activeBathroomStations: BathroomStation[] = []
  private static tutorialSystem: TutorialSystemComponent | null = null
  private static mainCamera: THREE.Camera | null = null
  private static player: GameObject | null = null
  private static environment: BurgerShopEnvironment | null = null
  private static cameraManager: CameraManager | null = null

  /**
   * Register the player
   * Register the environment
   */
  public static registerEnvironment(environment: BurgerShopEnvironment): void {
    this.environment = environment
  }

  /**
   * Register a checkout station as active
   */
  public static registerCheckoutStation(station: CheckoutStation): void {
    if (!this.activeCheckoutStations.includes(station)) {
      this.activeCheckoutStations.push(station)
    }
  }

  /**
   * Register a self-checkout station as active
   */
  public static registerSelfCheckoutStation(station: SelfCheckoutStation): void {
    if (!this.activeSelfCheckoutStations.includes(station)) {
      this.activeSelfCheckoutStations.push(station)
    }
  }

  /**
   * Register a burger station as active
   */
  public static registerBurgerStation(station: ProductionStation): void {
    if (!this.activeBurgerStations.includes(station)) {
      this.activeBurgerStations.push(station)
    }
  }

  /**
   * Register a table as active
   */
  public static registerTable(table: Table): void {
    if (!this.activeTables.includes(table)) {
      this.activeTables.push(table)
    }
  }

  /**
   * Register a trash can as active
   */
  public static registerTrashCan(trashCan: TrashCan): void {
    if (!this.activeTrashCans.includes(trashCan)) {
      this.activeTrashCans.push(trashCan)
    }
  }

  /**
   * Register a drive-thru as active
   */
  public static registerDrivethru(drivethru: Drivethru): void {
    if (!this.activeDrivethrus.includes(drivethru)) {
      this.activeDrivethrus.push(drivethru)
    }
  }

  /**
   * Register the tutorial system
   */
  public static registerTutorialSystem(tutorialSystem: TutorialSystemComponent): void {
    this.tutorialSystem = tutorialSystem
  }

  /**
   * Register the camera manager
   */
  public static registerCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager
  }

  /**
   * Get the camera manager
   */
  public static getCameraManager(): CameraManager | null {
    return this.cameraManager
  }

  /**
   * Register the player GameObject
   */
  public static registerPlayer(player: GameObject): void {
    this.player = player
  }

  /**
   * Get the player GameObject
   */
  public static getPlayer(): GameObject | null {
    return this.player
  }

  /**
   * Register a bathroom station as active
   */
  public static registerBathroomStation(bathroomStation: BathroomStation): void {
    if (!this.activeBathroomStations.includes(bathroomStation)) {
      this.activeBathroomStations.push(bathroomStation)
    }
  }

  /**
   * Find the active tutorial system
   */
  public static getTutorialSystem(): TutorialSystemComponent | null {
    return this.tutorialSystem
  }

  /**
   * Get the environment
   */
  public static getEnvironment(): BurgerShopEnvironment | null {
    return this.environment
  }

  /**
   * Get all active checkout stations
   */
  public static getActiveCheckoutStations(): CheckoutStation[] {
    return [...this.activeCheckoutStations]
  }

  /**
   * Get all active self-checkout stations
   */
  public static getActiveSelfCheckoutStations(): SelfCheckoutStation[] {
    return [...this.activeSelfCheckoutStations]
  }

  /**
   * Get all active burger stations
   */
  public static getActiveBurgerStations(): ProductionStation[] {
    return [...this.activeBurgerStations]
  }

  /**
   * Get all active tables
   */
  public static getActiveTables(): Table[] {
    return [...this.activeTables]
  }

  /**
   * Get all active trash cans
   */
  public static getActiveTrashCans(): TrashCan[] {
    return [...this.activeTrashCans]
  }

  /**
   * Get all active drive-thrus
   */
  public static getActiveDrivethrus(): Drivethru[] {
    return [...this.activeDrivethrus]
  }

  /**
   * Get all active bathroom stations
   */
  public static getActiveBathroomStations(): BathroomStation[] {
    return [...this.activeBathroomStations]
  }

  /**
   * Set the main camera for UI systems
   */
  public static setMainCamera(camera: THREE.Camera): void {
    this.mainCamera = camera
  }

  /**
   * Get the main camera for UI systems
   */
  public static getMainCamera(): THREE.Camera | null {
    return this.mainCamera
  }

  /**
   * Clear all registered stations (for cleanup)
   */
  public static clear(): void {
    this.activeCheckoutStations = []
    this.activeSelfCheckoutStations = []
    this.activeBurgerStations = []
    this.activeTables = []
    this.activeTrashCans = []
    this.activeDrivethrus = []
    this.activeBathroomStations = []
    this.mainCamera = null
  }

  /**
   * Find an available checkout station that customers can use
   */
  public static findAvailableCheckoutStation(): CheckoutStation | null {
    // For now, just return the first active checkout station if any
    return this.activeCheckoutStations.length > 0
      ? this.activeCheckoutStations[0]
      : null
  }

  /**
   * Find a checkout station by item type (e.g., "burger", "shake")
   * Returns the first active checkout station that handles the specified item type
   */
  public static getCheckoutStationByItemType(itemType: string): CheckoutStation | null {
    for (const station of this.activeCheckoutStations) {
      if (station.getItemType() === itemType) {
        return station
      }
    }
    return null
  }

  /**
   * Find an available drive-thru that customers can use
   */
  public static findAvailableDrivethru(): Drivethru | null {
    // For now, just return the first active drive-thru if any
    return this.activeDrivethrus.length > 0
      ? this.activeDrivethrus[0]
      : null
  }

  /**
   * Find an available table for customers to sit at
   * Prioritizes tables with 1 person already seated for social dining
   */
  public static findAvailableTable(): Table | null {
    // First, look for tables with 1 person (prioritize social dining)
    for (const table of this.activeTables) {
      if (table.isAvailable() && table.getOccupiedChairCount() === 1) {
        return table
      }
    }
    
    // If no partially occupied tables, look for empty tables
    for (const table of this.activeTables) {
      if (table.isAvailable() && table.getOccupiedChairCount() === 0) {
        return table
      }
    }
    
    return null // No available tables
  }

  /**
   * Find an available bathroom station for customers to use
   */
  public static findAvailableBathroomStation(): BathroomStation | null {
    let bestOpenStalls = -1
    let bestCustomersInLine = 100
    let bestStation: BathroomStation | null = null

    for (const station of this.activeBathroomStations) {
      if (!station.isAvailable()) {
        continue
      }

      const openStalls = station.getNumberOfOpenStalls()
      const customersInLine = station.getCustomerLine().getLineLength()
      if (openStalls > bestOpenStalls || (openStalls === bestOpenStalls && customersInLine < bestCustomersInLine)) {
        bestOpenStalls = openStalls
        bestCustomersInLine = customersInLine
        bestStation = station
      }
    }
    return bestStation
  }

  /**
   * Find a checkout station that needs burgers from employees
   */
  public static findCheckoutStationNeedingBurgers(): CheckoutStation | null {
    // TODO: Add logic to check inventory levels
    return this.activeCheckoutStations.length > 0
      ? this.activeCheckoutStations[0]
      : null
  }

  /**
   * Find a table that has trash for employees to clean
   */
  public static findTableWithTrash(): Table | null {
    // Find the first table that has trash
    for (const table of this.activeTables) {
      if (table.hasTrash()) {
        return table
      }
    }
    return null // No tables with trash
  }

  /**
   * Find an occupied table (has customers eating or dirty with trash)
   * Returns dirty tables first, then tables with eating customers
   */
  public static findOccupiedTable(): Table | null {
    // First priority: tables with trash (dirty/needs cleaning)
    for (const table of this.activeTables) {
      if (table.hasTrash()) {
        return table
      }
    }
    // Second priority: tables with customers currently eating
    for (const table of this.activeTables) {
      if (table.getOccupiedChairCount() > 0) {
        return table
      }
    }
    return null
  }

  /**
   * Find an available trash can for employees to dispose waste
   */
  public static findAvailableTrashCan(): TrashCan | null {
    return this.activeTrashCans.length > 0 ? this.activeTrashCans[0] : null
  }

  /**
   * Find a checkout station with burgers to sell
   */
  public static findCheckoutStationWithBurgersToSell(): CheckoutStation | null {
    // TODO: Add logic to check checkout inventory
    return this.activeCheckoutStations.length > 0
      ? this.activeCheckoutStations[0]
      : null
  }

  /**
   * Find a burger station with ready burgers for employees to collect
   */
  public static findBurgerStationWithBurgers(): ProductionStation | null {
    // TODO: Add logic to check burger inventory
    return this.activeBurgerStations.length > 0
      ? this.activeBurgerStations[0]
      : null
  }
}
