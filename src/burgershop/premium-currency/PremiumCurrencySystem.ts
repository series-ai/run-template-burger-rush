import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

/**
 * Premium Currency System - Static Utility Class
 * Manages premium currency for in-app purchases
 * Uses RundotGameAPI.iap for real currency operations
 */
export class PremiumCurrencySystem {
  // Icon path - centralized reference
  private static readonly ICON_PATH = './assets/cozy_game_general/premium_currency.png'
  private static initialized: boolean = false

  /* COMMENTED OUT - OLD FAKE IMPLEMENTATION
  private static currentAmount: number = 0

  /**
   * Get random delay between 100-2000ms for mock API calls
   */
  /*
  private static getRandomDelay(): number {
    return Math.random() * 1900 + 100 // 100-2000ms
  }
  */

  /**
   * Initialize the premium currency system
   */
  public static async initialize(): Promise<void> {
    if (PremiumCurrencySystem.initialized) {
      return
    }

    PremiumCurrencySystem.initialized = true
  }

  /**
   * Get current premium currency amount using RundotGameAPI
   */
  public static async getCurrentAmount(): Promise<number> {
    try {
      return await RundotGameAPI.iap.getHardCurrencyBalance()
    } catch (error) {
      console.error('Failed to get currency balance:', error)
      return 0
    }
  }

  /**
   * Spend premium currency using RundotGameAPI
   */
  public static async spendCurrency(amount: number, productId: string = "premium-purchase"): Promise<boolean> {
    try {
      await RundotGameAPI.iap.spendCurrency(productId, amount)
      return true
    } catch (error) {
      console.error('Failed to spend currency:', error)
      return false
    }
  }

  /**
   * Add premium currency - Note: Not available with real API
   * This method is kept for backward compatibility but logs a warning
   */
  public static addCurrency(amount: number): number {
    console.warn('addCurrency() is not supported with real RundotGameAPI. Currency can only be added through purchases.')
    return 0
  }

  /* COMMENTED OUT - OLD FAKE IMPLEMENTATION
  /**
   * Initialize the premium currency system
   */
  /*
  public static async initialize(): Promise<void> {
    if (PremiumCurrencySystem.initialized) {
      return
    }

    // Load initial currency amount (this will set initialized to true)
    await PremiumCurrencySystem.getCurrentAmount()
  }

  /**
   * Get current premium currency amount (loads on first call)
   */
  /*
  public static async getCurrentAmount(): Promise<number> {
    if (!PremiumCurrencySystem.initialized) {
      // First call - load from wallet (mock)
      await new Promise(resolve => setTimeout(resolve, PremiumCurrencySystem.getRandomDelay()))
      PremiumCurrencySystem.currentAmount = 2 // Start with 2 for testing
      PremiumCurrencySystem.initialized = true
    } else {
      // Subsequent calls - mock API delay
      await new Promise(resolve => setTimeout(resolve, PremiumCurrencySystem.getRandomDelay()))
    }
    
    return PremiumCurrencySystem.currentAmount
  }

  /**
   * Spend premium currency (mock async - will be replaced with RundotGameAPI.iap.spendCurrency)
   */
  /*
  public static async spendCurrency(amount: number): Promise<boolean> {
    // Mock async delay
    await new Promise(resolve => setTimeout(resolve, PremiumCurrencySystem.getRandomDelay()))
    
    if (PremiumCurrencySystem.currentAmount >= amount) {
      PremiumCurrencySystem.currentAmount -= amount
      return true
    } else {
      return false
    }
  }

  /**
   * Add premium currency and return new amount
   */
  /*
  public static addCurrency(amount: number): number {
    PremiumCurrencySystem.currentAmount += amount
    return PremiumCurrencySystem.currentAmount
  }
  */

  /**
   * Get the centralized icon path
   */
  public static getIconPath(): string {
    return PremiumCurrencySystem.ICON_PATH
  }

  /**
   * Check if system is initialized
   */
  public static isInitialized(): boolean {
    return PremiumCurrencySystem.initialized
  }
}
