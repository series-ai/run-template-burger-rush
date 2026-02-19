import { ShopButton } from './ShopButton'
import { ShopPopup } from './ShopPopup'
import { ShopData } from './ShopData'
import { ShopItem } from './ShopItem'
import { PremiumCurrencySystem } from '../premium-currency'

/** Set to true to show the shop button in the UI */
const SHOP_BUTTON_ENABLED = false

/**
 * Main shop system that coordinates the button, popup, and data management
 * Entry point for premium currency purchases
 * 
 * Usage:
 * ```typescript
 * // Initialize first (required!)
 * const shop = ShopSystem.initialize()
 * 
 * // Then add items
 * shop.addItem({ 
 *   id: 'speed_boost', 
 *   title: '2x Speed Boost', 
 *   price: 25,
 *   currency: '💎',
 *   category: 'boosts',
 *   purchased: false,
 *   onPurchaseSuccess: () => { 
 *     PlayerSystem.applySpeedBoost(3600)
 *   } 
 * })
 * 
 * // Later access
 * const shop = ShopSystem.getInstance()
 * ```
 */
export class ShopSystem {
  private static instance: ShopSystem | null = null
  private shopButton: ShopButton
  private shopPopup: ShopPopup
  private shopData: ShopData
  private isInitialized: boolean = false

  private constructor() {
    this.shopButton = ShopButton.getInstance()
    this.shopPopup = ShopPopup.getInstance()
    this.shopData = ShopData.getInstance()
  }

  public static getInstance(): ShopSystem {
    if (!ShopSystem.instance) {
      throw new Error('ShopSystem must be initialized first! Call ShopSystem.initialize() instead.')
    }
    return ShopSystem.instance
  }

  /**
   * Initialize the shop system - must be called first
   */
  public static async initialize(): Promise<ShopSystem> {
    if (ShopSystem.instance) {
      console.warn('⚠️ ShopSystem already initialized!')
      return ShopSystem.instance
    }
    
    ShopSystem.instance = new ShopSystem()
    
    // Initialize premium currency system
    await PremiumCurrencySystem.initialize()
    
    ShopSystem.instance.setupSystem()
    return ShopSystem.instance
  }

  /**
   * Add an item to the shop
   */
  public addItem(item: ShopItem): void {
    this.shopData.addItem(item)
    
    // Refresh shop if it's currently open
    if (this.isShopOpen()) {
      this.refresh()
    }
  }

  /**
   * Remove an item from the shop
   */
  public removeItem(itemId: string): void {
    this.shopData.removeItem(itemId)
    
    // Refresh shop if it's currently open
    if (this.isShopOpen()) {
      this.refresh()
    }
  }

  /**
   * Set up the shop system components
   */
  private setupSystem(): void {
    if (this.isInitialized) {
      return
    }

    // Initialize the shop button with click handler
    this.shopButton.initialize(() => {
      this.openShop()
    })

    // Hide button if disabled
    if (!SHOP_BUTTON_ENABLED) {
      this.shopButton.hide()
    }

    // Purchase handling is now done directly by ShopItemCard

    this.isInitialized = true
    console.log('🛒 Shop system initialized')
  }

  /**
   * Open the shop popup
   */
  public openShop(): void {
    if (!this.isInitialized) {
      console.warn('⚠️ ShopSystem not initialized!')
      return
    }

    // Show the popup
    this.shopPopup.show()

    console.log('🛒 Shop opened')
  }

  /**
   * Close the shop popup
   */
  public closeShop(): void {
    this.shopPopup.hide()
    console.log('🛒 Shop closed')
  }

  /**
   * Check if shop is currently open
   */
  public isShopOpen(): boolean {
    return this.shopPopup.isOpen()
  }

  /**
   * Show the shop button (respects SHOP_BUTTON_ENABLED flag)
   */
  public showButton(): void {
    if (!SHOP_BUTTON_ENABLED) return
    this.shopButton.show()
  }

  /**
   * Hide the shop button
   */
  public hideButton(): void {
    this.shopButton.hide()
  }

  /**
   * Refresh shop content (useful after restocking or debug operations)
   */
  public refresh(): void {
    this.shopPopup.refresh()
  }

  /**
   * Get shop statistics for debugging
   */
  public getStats(): any {
    const allItems = this.shopData.getAllItems()

    return {
      totalItems: allItems.length,
      hasItems: this.shopData.hasItems(),
      isInitialized: this.isInitialized,
      isShopOpen: this.isShopOpen(),
      itemIds: allItems.map(item => item.id)
    }
  }

  /**
   * Load sample items for testing (optional - call manually for demos)
   */
  public loadSampleItems(): void {
    // Import and add sample items
    import('./ShopItem').then(({ SAMPLE_SHOP_ITEMS }) => {
      SAMPLE_SHOP_ITEMS.forEach(item => {
        this.addItem(item)
      })
      console.log(`🛒 Loaded ${SAMPLE_SHOP_ITEMS.length} sample shop items`)
    })
  }


  /**
   * Cleanup the shop system
   */
  public destroy(): void {
    this.shopPopup.hide()
    this.shopButton.destroy()
    this.isInitialized = false

    console.log('🛒 Shop system destroyed')
  }

  /**
   * Reset the shop system to initial state
   */
  public reset(): void {
    this.destroy()
    ShopSystem.instance = null
  }
}
