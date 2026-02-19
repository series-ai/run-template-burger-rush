import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { GameObject } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { CostManager } from "./CostManager"
import { OneOffMoneyReward } from "./OneOffMoneyReward"
import { BurgerShopDirectory } from "@game"
import * as THREE from "three"

/**
 * Three.js version of MoneySystem for managing money and displaying UI elements
 * Singleton pattern with static methods for global access
 * Integrates with Venus API for persistent storage and UISystem for display
 */
export class MoneySystem {
  // Consistent money colors used across all money-related UI
  public static readonly MONEY_COLORS = {
    GREEN_GRADIENT: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
    GREEN_SHADOW: '#16a34a',
    RED_GRADIENT: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // Darker red
    RED_SHADOW: '#dc2626', // Darker red shadow
    GREEN_SOLID: '#22c55e', // Balanced money green for purchase area fill
  }
  private static instance: MoneySystem | null = null

  // Storage key for Venus API
  private static readonly STORAGE_KEY_MONEY = "burger_shop_money"
  // Default money is now managed by CostManager

  private money: number = 0 // Actual money value
  private displayMoney: number = 0 // What shows in UI (animates toward money)
  private onMoneyChanged: ((amount: number) => void) | null = null
  private playerGameObject: GameObject | null = null
  private isInitialized: boolean = false

  // Money UI reference (set by MoneyUI when initialized)
  private static moneyUIInstance: any = null

  // Simple animation
  private animationStartTime: number = 0 // When current animation started
  private animationStartMoney: number = 0 // What displayMoney was when animation started
  private animationDuration: number = 0.5 // Always 0.5 seconds
  private updateInterval: any = null

  // For periodic saving
  private lastSavedMoney: number = -1
  private saveIntervalId: any = null

  // OneOffMoneyReward pooling (similar to SelfCheckoutCustomerSpawner pattern)
  private static rewardPool: OneOffMoneyReward[] = []
  private static totalRewardsCreated: number = 0


  private constructor() {
    // Initialize UISystem
    UISystem.initialize()
    this.updateMoneyDisplay()
    this.startUpdateLoop()
  }

  /**
   * Initialize the MoneySystem singleton with Venus API storage
   */
  public static async initialize(): Promise<MoneySystem> {
    if (MoneySystem.instance) {
      console.warn("MoneySystem already initialized")
      return MoneySystem.instance
    }

    MoneySystem.instance = new MoneySystem()
    await MoneySystem.instance.loadMoney()
    MoneySystem.instance.isInitialized = true
    MoneySystem.instance.startPeriodicSave()
    // MoneySystem initialized
    return MoneySystem.instance
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): MoneySystem {
    if (!MoneySystem.instance) {
      throw new Error("MoneySystem not initialized! Call initialize() first.")
    }
    return MoneySystem.instance
  }

  /**
   * Load money from Venus API storage
   */
  private async loadMoney(): Promise<void> {
    try {
      const savedMoney = await RundotGameAPI.appStorage.getItem(
        MoneySystem.STORAGE_KEY_MONEY,
      )
      if (savedMoney) {
        this.money = parseInt(savedMoney, 10)
        // Money loaded from save
      } else {
        this.money = CostManager.getCost("starting_money")
        RundotGameAPI.log(`💰 Using default starting money: $${this.money}`)
      }
      // Set display money to match loaded money (no animation on startup)
      this.displayMoney = this.money
      this.updateMoneyDisplay()
    } catch (error) {
      console.error("❌ Failed to load money from storage:", error)
      this.money = CostManager.getCost("starting_money")
      this.displayMoney = this.money
      RundotGameAPI.log(
        `💰 Using default starting money due to error: $${this.money}`,
      )
      this.updateMoneyDisplay()
    }
  }

  /**
   * Save money to Venus API storage
   */
  private async saveMoney(): Promise<void> {
    await RundotGameAPI.appStorage.setItem(
      MoneySystem.STORAGE_KEY_MONEY,
      this.money.toString(),
    )
  }

  /**
   * Starts a periodic check to save money if it has changed
   */
  private startPeriodicSave(): void {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId)
    }

    this.lastSavedMoney = this.money

    this.saveIntervalId = setInterval(() => {
      if (this.money !== this.lastSavedMoney) {
        // Auto-saving money change
        this.saveMoney()
        this.lastSavedMoney = this.money
      }
    }, 1000) // Check every second
  }

  /**
   * Start update loop for display money animation
   */
  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateDisplayMoney(1/60) // 60fps
    }, 16) // ~60fps
  }

  /**
   * Update display money toward actual money over 3 seconds
   */
  private updateDisplayMoney(deltaTime: number): void {
    if (this.displayMoney < this.money && this.animationStartTime > 0) {
      const elapsedTime = (Date.now() - this.animationStartTime) / 1000
      
      if (elapsedTime < this.animationDuration) {
        // Move towards money over 3 seconds
        const progress = elapsedTime / this.animationDuration
        this.displayMoney = this.animationStartMoney + (this.money - this.animationStartMoney) * progress
      } else {
        // Animation complete
        this.displayMoney = this.money
        this.animationStartTime = 0
      }
      
      // Update UI with animated value
      this.updateMoneyDisplay()
    }
  }

  /**
   * Update the money display UI using MoneyUI
   */
  private updateMoneyDisplay(): void {
    // Update through MoneyUI (registered when MoneyUI is initialized)
    if (MoneySystem.moneyUIInstance) {
      MoneySystem.moneyUIInstance.updateMoneyDisplay()
    }
  }

  /**
   * Register MoneyUI instance (called by MoneyUI during initialization)
   */
  public static setMoneyUI(moneyUIInstance: any): void {
    MoneySystem.moneyUIInstance = moneyUIInstance
  }

  /**
   * Set a callback for when money changes
   */
  public setOnMoneyChanged(callback: (amount: number) => void): void {
    this.onMoneyChanged = callback
  }

  /**
   * Set the player GameObject for money display positioning
   */
  public setPlayerGameObject(playerObject: GameObject): void {
    this.playerGameObject = playerObject
  }

  /**
   * Add money instantly (for purchases) - updates both actual and display money immediately
   */
  public addMoney(amount: number): void {
    // Update both actual and display money instantly
    this.money += amount
    this.displayMoney = this.money
    
    // Update display immediately
    this.updateMoneyDisplay()
    
    // Notify listeners immediately
    if (this.onMoneyChanged) {
      this.onMoneyChanged(this.money)
    }
  }

  /**
   * Add money with animation (for earning) - updates actual money, display catches up
   */
  public addMoneyAnimated(amount: number): void {
    // Update actual money
    this.money += amount
    
    // Start animation from current display to new actual money
    this.startMoneyAnimation()
    
    // Notify listeners immediately for actual money change
    if (this.onMoneyChanged) {
      this.onMoneyChanged(this.money)
    }
  }

  /**
   * Start a 3-second animation from current display to actual money
   */
  private startMoneyAnimation(): void {
    this.animationStartTime = Date.now()
    this.animationStartMoney = this.displayMoney
  }

  /**
   * Try to spend money
   * @returns True if successful, false if not enough money
   */
  public spendMoney(amount: number): boolean {
    if (this.money >= amount) {
      this.money -= amount
      this.displayMoney = this.money // Instant drop for spending - no animation
      this.updateMoneyDisplay()

      // Notify listeners
      if (this.onMoneyChanged) {
        this.onMoneyChanged(this.money)
      }

      return true
    }

    return false
  }

  /**
   * Set money directly (useful for debugging)
   */
  public setMoney(amount: number): void {
    this.money = Math.max(0, amount) // Ensure non-negative
    this.displayMoney = this.money // Instant change for direct sets
    this.updateMoneyDisplay()

    // Notify listeners
    if (this.onMoneyChanged) {
      this.onMoneyChanged(this.money)
    }
  }

  /**
   * Get current money amount
   */
  public getMoney(): number {
    return this.money
  }

  /**
   * Static method to add money
   */
  public static addMoney(amount: number): void {
    MoneySystem.getInstance().addMoney(amount)
  }

  public static addMoneyAnimated(amount: number): void {
    MoneySystem.getInstance().addMoneyAnimated(amount)
  }

  /**
   * Static method to spend money
   */
  public static spendMoney(amount: number): boolean {
    return MoneySystem.getInstance().spendMoney(amount)
  }

  /**
   * Static method to get current money amount (actual value)
   */
  public static getMoney(): number {
    return MoneySystem.getInstance().getMoney()
  }

  /**
   * Static method to get display money amount (animated value for UI)
   */
  public static getDisplayMoney(): number {
    const instance = MoneySystem.getInstance()
    return Math.floor(instance.displayMoney)
  }

  /**
   * Static method to set money directly
   */
  public static setMoney(amount: number): void {
    MoneySystem.getInstance().setMoney(amount)
  }

  /**
   * Get the default starting money amount
   */
  public static getDefaultMoney(): number {
    return CostManager.getCost("starting_money")
  }

  /**
   * Set player GameObject (static)
   */
  public static setPlayerGameObject(playerObject: GameObject): void {
    MoneySystem.getInstance().setPlayerGameObject(playerObject)
  }

  /**
   * Return a OneOffMoneyReward to the pool (called by OneOffMoneyReward when done)
   */
  public static ReturnRewardToPool(reward: OneOffMoneyReward): void {
    MoneySystem.rewardPool.push(reward)
  }

  /**
   * Create a new OneOffMoneyReward on-demand (lazy instantiation)
   */
  private static createNewReward(): OneOffMoneyReward {
    MoneySystem.totalRewardsCreated++
    const rewardObject = new GameObject(`PooledOneOffMoneyReward_${MoneySystem.totalRewardsCreated}`)
    rewardObject.position.set(0, 0, -35) // Off-screen initially
    const reward = new OneOffMoneyReward()
    rewardObject.addComponent(reward)
    
    return reward
  }

  /**
   * Show a one-off money reward at the player's location
   * Gets reward from pool or creates new one (lazy instantiation)
   */
  public OneOffReward(amount: number): void {
    // Get player position
    const player = BurgerShopDirectory.getPlayer()
    if (!player) {
      console.warn("Cannot show OneOffReward: Player not found")
      return
    }

    // Get camera
    const camera = BurgerShopDirectory.getMainCamera()
    if (!camera) {
      console.warn("Cannot show OneOffReward: Camera not found")
      return
    }

    // Get reward from pool, or create new if pool is empty (lazy instantiation)
    const reward = MoneySystem.rewardPool.length > 0 
      ? MoneySystem.rewardPool.pop()! 
      : MoneySystem.createNewReward()
    
    // Get player's world position
    const playerPosition = new THREE.Vector3()
    player.getWorldPosition(playerPosition)

    // Show the reward at player's position
    reward.show(amount, playerPosition, camera)
  }

  /**
   * Static method to show a one-off money reward
   */
  public static OneOffReward(amount: number): void {
    MoneySystem.getInstance().OneOffReward(amount)
    MoneySystem.addMoneyAnimated(amount)
  }

  /**
   * Dispose of the money system
   */
  public static dispose(): void {
    if (MoneySystem.instance) {
      if (MoneySystem.instance.saveIntervalId) {
        clearInterval(MoneySystem.instance.saveIntervalId)
      }
      MoneySystem.instance = null
    }
    
    // Clear the reward pool
    for (const reward of MoneySystem.rewardPool) {
      reward.getGameObject().dispose()
    }
    MoneySystem.rewardPool = []
    MoneySystem.totalRewardsCreated = 0
  }
}
