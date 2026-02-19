import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { PlayAudioOneShot2D, Main2DAudioBank, StowKitSystem, ParticleSystemPrefabComponent, PrefabLoader } from "@series-inc/rundot-3d-engine/systems"
import { PurchaseArea, IUnlockable, CostManager } from "@game/money"
import { StationLevelManager } from "./StationLevelManager"

export interface StationLevelComponentConfig {
  costKeys: string[]
  label: string
  size: THREE.Vector2
  storageKey: string
  onChange?: (level: number, fromStorage?: boolean) => void
  startUnlocked?: boolean // If false, must be unlocked via UnlockManager (defaults to true)
  displayName?: string // Display name for UnlockManager (required if startUnlocked is false)
  playUpgradeSound?: boolean // If true, plays "upgrade" sound on level complete (defaults to true)
}

/**
 * Component for managing station upgrade levels
 * 
 * IMPORTANT: StationLevelManager.initialize() must be called at startup (in BurgerShopDemo)
 * before any StationLevelComponent is used. This ensures all levels are pre-loaded
 * and eliminates race conditions.
 */
export class StationLevelComponent extends Component implements IUnlockable {
  private config: StationLevelComponentConfig
  private currentLevel: number = 0
  private purchaseAreaObject: GameObject | null = null
  private purchaseArea: PurchaseArea | null = null
  private isEnabled: boolean = false
  private isSetup: boolean = false
  private isUnlocked: boolean = false

  constructor(config: StationLevelComponentConfig) {
    super()
    this.config = config
    // Default to unlocked if not specified
    this.isUnlocked = config.startUnlocked !== false
  }

  protected onCreate(): void {}

  /**
   * Set up the component by reading the level from StationLevelManager (synchronous)
   * This replaces the old async initialize() method.
   * 
   * Call this when the station is acquired to apply saved level and create purchase area.
   */
  public setup(): void {
    if (this.isSetup) {
      return
    }

    if (!StationLevelManager.isReady()) {
      console.warn(`StationLevelManager not initialized! Cannot setup ${this.config.storageKey}`)
      return
    }

    // Read level synchronously from the pre-loaded manager
    const savedLevel = StationLevelManager.getLevel(this.config.storageKey)
    if (savedLevel >= 0 && savedLevel <= this.config.costKeys.length) {
      this.currentLevel = savedLevel
    }

    this.isSetup = true

    // Apply the loaded level's effects (mesh, speed, capacity, etc.)
    // Pass true to indicate this is loading from storage (skip animations)
    if (this.currentLevel > 0 && this.config.onChange) {
      this.config.onChange(this.currentLevel, true)
    }

    // Create purchase area for the next level if not maxed
    if (this.currentLevel < this.config.costKeys.length) {
      this.createPurchaseAreaForLevel(this.currentLevel)
    }
  }

  private createPurchaseAreaForLevel(level: number): void {
    if (level >= this.config.costKeys.length) {
      if (this.purchaseAreaObject){
        this.purchaseAreaObject.dispose()
        this.purchaseAreaObject = null
        this.purchaseArea = null
      }
      return
    }

    const costKey = this.config.costKeys[level]
    const cost = CostManager.getCost(costKey)

    if (!this.purchaseAreaObject) {
      this.purchaseAreaObject = new GameObject(`${this.config.label}_PurchaseArea`)
      this.gameObject.getWorldPosition(this.purchaseAreaObject.position)

      const label = "Upgrade" // Bold emoji arrow for universal upgrade indicator

      this.purchaseArea = new PurchaseArea(
        cost,
        this.config.size,
        label,
        () => this.onLevelComplete()
      )

      this.purchaseAreaObject.addComponent(this.purchaseArea)
      this.purchaseAreaObject.setEnabled(this.isEnabled)
    } else {
      this.purchaseArea?.reset(cost)
      this.purchaseAreaObject.setEnabled(this.isEnabled)
    }
  }

  private onLevelComplete(): void {
    this.currentLevel++

    // Save to manager (fire-and-forget, non-blocking)
    StationLevelManager.setLevel(this.config.storageKey, this.currentLevel)

    // Play upgrade sound and particles (defaults to true)
    if (this.config.playUpgradeSound !== false) {
      try {
        const audio = Main2DAudioBank["upgrade2"]
        if (audio && audio.buffer) {
          audio.setVolume(0.5) // 50% volume
          audio.play()
        }
      } catch (error) {
        console.warn("Failed to play upgrade2 sound:", error)
      }
      this.spawnUpgradeEffect()
    }

    // Pass false to indicate this is a new upgrade (play animations)
    if (this.config.onChange) {
      this.config.onChange(this.currentLevel, false)
    }

    if (this.currentLevel < this.config.costKeys.length) {
      this.createPurchaseAreaForLevel(this.currentLevel)
    }
  }

  /**
   * Spawn the upgrade particle effect above the station
   */
  private spawnUpgradeEffect(): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const upgradePrefab = prefabCollection.getPrefabByName("pfx_table_station_first_purchase")

    if (!upgradePrefab) {
      console.warn("pfx_table_station_first_purchase prefab not found")
      return
    }

    // Create a temporary holder positioned 2 meters above the station
    const effectHolder = new GameObject("UpgradeEffectHolder")
    const stationWorldPos = new THREE.Vector3()
    this.gameObject.getWorldPosition(stationWorldPos)
    effectHolder.position.copy(stationWorldPos)
    effectHolder.position.y += 2

    // Instantiate the prefab
    const instance = PrefabLoader.instantiatePrefab(upgradePrefab, effectHolder)
    const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

    if (particleComponent) {
      particleComponent.play()

      // Clean up the effect after 5 seconds
      setTimeout(() => {
        effectHolder.dispose()
      }, 5000)
    } else {
      effectHolder.dispose()
    }
  }

  public enable(): void {
    if (!this.isSetup) {
      console.warn(`Cannot enable upgrade ${this.config.storageKey} - not set up. Call setup() first.`)
      return
    }

    // Only enable if unlocked
    if (!this.isUnlocked) {
      console.warn(`Cannot enable upgrade ${this.config.storageKey} - not unlocked yet.`)
      return
    }

    this.isEnabled = true
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.setEnabled(true)
    }
  }

  public disable(): void {
    this.isEnabled = false
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.setEnabled(false)
    }
  }

  public getLevel(): number {
    return this.isSetup ? this.currentLevel : -1
  }

  public isMaxLevel(): boolean {
    return this.currentLevel >= this.config.costKeys.length
  }

  public isReady(): boolean {
    return this.isSetup
  }

  public getMaxLevel(): number {
    return this.config.costKeys.length - 1
  }

  public debugReset(): void {
    StationLevelManager.resetLevel(this.config.storageKey)
    this.currentLevel = 0
    
    if (this.isEnabled) {
      this.createPurchaseAreaForLevel(0)
    }

    // Pass false for debug reset (play animations)
    if (this.config.onChange) {
      this.config.onChange(this.currentLevel, false)
    }
  }

  protected onCleanup(): void {
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.dispose()
      this.purchaseAreaObject = null
      this.purchaseArea = null
    }

    super.onCleanup()
  }

  // IUnlockable implementation
  public unlock(): void {
    this.isUnlocked = true
    // Enable the component now that it's unlocked
    if (this.isSetup) {
      this.enable()
    }
  }

  public acquire(fromStorage?: boolean): void {
    // Station levels don't have a one-time acquisition
    // They're progressively purchased through the purchase areas
    // This method is here to satisfy IUnlockable interface
  }

  public getCost(): number {
    // Cost is handled by individual purchase areas for each level
    return 0
  }

  public getDisplayName(): string {
    return this.config.displayName || this.config.label
  }

  public getUnlockableId(): string {
    return this.config.storageKey
  }
}
