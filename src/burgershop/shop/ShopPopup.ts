import { ShopData } from './ShopData'
import { ShopItemCard } from './ShopItemCard'
import { ShopItem } from './ShopItem'
import { BurgerShopUI } from '../ui/BurgerShopUI'
import { PremiumCurrencySystem } from '../premium-currency'

/**
 * Shop popup system with item grid layout and scrolling
 * Handles the main shop interface and item management
 */
export class ShopPopup {
  private static instance: ShopPopup | null = null
  private overlay: HTMLElement | null = null
  private container: HTMLElement | null = null
  private contentContainer: HTMLElement | null = null
  private itemsContainer: HTMLElement | null = null
  private emptyStateContainer: HTMLElement | null = null
  private premiumCurrencyDisplay: HTMLElement | null = null
  private isVisible: boolean = false
  private shopData: ShopData
  private itemCards: ShopItemCard[] = []
  
  // Debug flags
  private static showSamplesDebug: boolean = false

  private constructor() {
    this.shopData = ShopData.getInstance()
  }

  public static getInstance(): ShopPopup {
    if (!ShopPopup.instance) {
      ShopPopup.instance = new ShopPopup()
    }
    return ShopPopup.instance
  }

  /**
   * Enable/disable debug samples button in empty state
   */
  public static setShowSamplesDebug(show: boolean): void {
    ShopPopup.showSamplesDebug = show
  }


  /**
   * Show the shop popup
   */
  public show(): void {
    if (this.isVisible) {
      return
    }

    this.createPopup()
    this.renderContent()
    this.isVisible = true
    // Update premium currency display when showing
    this.updatePremiumCurrencyDisplay()
  }

  /**
   * Hide the shop popup
   */
  public hide(): void {
    if (!this.isVisible || !this.overlay) {
      return
    }

    // Cleanup item cards
    this.itemCards.forEach(card => card.destroy())
    this.itemCards = []

    // Remove overlay (which contains the entire popup)
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
    }
    
    // Clear references
    this.overlay = null
    this.container = null
    this.contentContainer = null
    this.itemsContainer = null
    this.emptyStateContainer = null
    this.premiumCurrencyDisplay = null
    this.isVisible = false

    // Clean up global close function
    delete (window as any).closeShopUI
  }

  /**
   * Create the popup structure using BurgerShopUI utilities (same as upgrade panels)
   */
  private createPopup(): void {
    if (this.overlay) {
      return
    }

    // Create overlay and container manually (same as upgrade panels)
    this.overlay = BurgerShopUI.createOverlay(() => this.hide())
    this.container = BurgerShopUI.createContainer()
    
    // Set container size (taller than upgrade panels to show ~1.5 shop items)
    this.container.style.width = '380px'
    this.container.style.minHeight = '480px'
    
    // Create title and close button (same as upgrade panels)
    const title = BurgerShopUI.createTitle('🛒 Shop', true)
    BurgerShopUI.createCloseButton(this.container, () => this.hide())
    
    // Add premium currency display to title area
    this.createPremiumCurrencyDisplay()
    title.appendChild(this.premiumCurrencyDisplay!)
    
    // Create content area
    this.contentContainer = BurgerShopUI.createContentArea()
    
    // Override content area styling for shop to prevent cutoff
    this.contentContainer.style.maxHeight = '360px' // More generous height for shop
    this.contentContainer.style.paddingBottom = '10px' // Extra padding at bottom
    
    // Assemble the panel (same as upgrade panels)
    this.container.appendChild(title)
    this.container.appendChild(this.contentContainer)
    this.overlay.appendChild(this.container)

    // Add to document
    document.body.appendChild(this.overlay)

    // Set up global close function (for compatibility)
    ;(window as any).closeShopUI = () => this.hide()

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide()
      }
    })
  }


  /**
   * Create premium currency display for top-left of shop
   */
  private createPremiumCurrencyDisplay(): void {
    this.premiumCurrencyDisplay = document.createElement('div')
    
    // Get current premium currency amount for initial display (use 0 if not initialized)
    const currentAmount = 0 // Will be updated async when popup shows
    
    this.premiumCurrencyDisplay.innerHTML = `
      <img src="${PremiumCurrencySystem.getIconPath()}" alt="Premium Currency" style="
        width: 20px; 
        height: 20px; 
        margin-right: 6px;
      ">
      ${currentAmount}
    `
    
    this.premiumCurrencyDisplay.style.cssText = `
      position: absolute;
      top: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      gap: 0px;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 12px;
      border-radius: 20px;
      backdrop-filter: blur(10px);
      font-size: 14px;
      font-weight: 600;
      color: white;
      font-family: var(--game-font);
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
      z-index: 10;
      pointer-events: none;
    `
  }

  /**
   * Update premium currency display
   */
  private async updatePremiumCurrencyDisplay(): Promise<void> {
    if (!this.premiumCurrencyDisplay || !PremiumCurrencySystem.isInitialized()) {
      return
    }
    
    try {
      const currentAmount = await PremiumCurrencySystem.getCurrentAmount()
      this.premiumCurrencyDisplay.innerHTML = `
        <img src="${PremiumCurrencySystem.getIconPath()}" alt="Premium Currency" style="
          width: 20px; 
          height: 20px; 
          margin-right: 6px;
        ">
        ${currentAmount}
      `
    } catch (error) {
      console.warn('Failed to update premium currency display:', error)
    }
  }

  /**
   * Create empty state container
   */
  private createEmptyStateContainer(): HTMLElement {
    if (ShopPopup.showSamplesDebug) {
      return BurgerShopUI.createEmptyState({
        icon: '🛍️',
        title: 'Shop Coming Soon',
        description: 'No items are currently available.<br>Check back later for deals and special offers!',
        buttonText: 'Load Samples (Debug)',
        onButtonClick: () => {
          // Load sample items for testing
          import('./ShopItem').then(({ SAMPLE_SHOP_ITEMS }) => {
            SAMPLE_SHOP_ITEMS.forEach(item => {
              this.shopData.addItem(item)
            })
            this.renderContent()
          })
        }
      })
    } else {
      return BurgerShopUI.createEmptyState({
        icon: '🛍️',
        title: 'Shop Coming Soon',
        description: 'No items are currently available.<br>Check back later for deals and special offers!'
      })
    }
  }

  /**
   * Render popup content based on available items
   */
  private renderContent(): void {
    if (!this.contentContainer) {
      return
    }

    // Clear existing content
    this.contentContainer.innerHTML = ''
    this.itemCards.forEach(card => card.destroy())
    this.itemCards = []

    const allItems = this.shopData.getAllItems()

    if (allItems.length === 0) {
      // Show empty state
      if (!this.emptyStateContainer) {
        this.emptyStateContainer = this.createEmptyStateContainer()
      }
      this.contentContainer.appendChild(this.emptyStateContainer)
    } else {
      // Create items grid
      this.itemsContainer = BurgerShopUI.createItemsGrid(allItems.length)
      this.contentContainer.appendChild(this.itemsContainer)

      // Create item cards
      allItems.forEach(item => {
        const card = new ShopItemCard(item, (itemId: string) => {
          // Purchase was already handled by ShopItemCard, just refresh the shop
          console.log(`🛒 Purchase completed for item: ${itemId}`)
          this.renderContent() // Refresh immediately since timing is handled by ShopItemCard
        })
        
        this.itemCards.push(card)
        const cardElement = card.createElement()
        this.itemsContainer!.appendChild(cardElement)
      })
    }
  }


  /**
   * Refresh the popup content (useful for debugging)
   */
  public refresh(): void {
    if (this.isVisible) {
      this.renderContent()
      // Also update premium currency display
      this.updatePremiumCurrencyDisplay()
    }
  }

  /**
   * Check if popup is currently visible
   */
  public isOpen(): boolean {
    return this.isVisible
  }
}
