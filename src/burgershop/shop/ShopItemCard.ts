import { ShopItem, PurchaseResult } from './ShopItem'
import { PremiumCurrencySystem } from '../premium-currency'
import { BurgerShopUI } from "../ui/BurgerShopUI"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

/**
 * Individual shop item card component with canvas area and purchase functionality
 */
export class ShopItemCard {
    private item: ShopItem
    private cardElement: HTMLElement | null = null
    private purchaseButton: HTMLElement | null = null
    private loadingOverlay: HTMLElement | null = null
    private onPurchaseComplete: ((itemId: string) => void) | null = null

    constructor(item: ShopItem, onPurchaseComplete?: (itemId: string) => void) {
        this.item = item
        this.onPurchaseComplete = onPurchaseComplete || null
    }

    /**
     * Create the shop item card HTML element
     */
    public createElement(): HTMLElement {
        if (this.cardElement) {
            return this.cardElement
        }

        this.cardElement = document.createElement('div')
        this.cardElement.className = 'shop-item-card'
        this.cardElement.style.cssText = `
      background: #C8E6F5;
      border-radius: 15px;
      box-shadow: 0 6px 0 #A8C8E1, 0 8px 15px rgba(0, 0, 0, 0.15);
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: auto;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      margin-bottom: 8px;
    `


        // Create title
        const titleElement = document.createElement('h3')
        titleElement.textContent = this.item.title
        titleElement.style.cssText = `
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 700;
      color: #374151;
      font-family: var(--game-font);
      text-shadow: none;
    `

        // Create description
        const descriptionElement = document.createElement('p')
        descriptionElement.textContent = this.item.description
        descriptionElement.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 14px;
      color: #6B7280;
      line-height: 1.3;
      font-family: var(--game-font);
      font-weight: 600;
      text-shadow: none;
    `

        // Create purchase button with price and currency icon
        this.purchaseButton = document.createElement('button')
        // Format price without unnecessary decimals and put on button
        const formattedPrice = this.item.price % 1 === 0
            ? this.item.price.toString()
            : this.item.price.toFixed(2)

        // Create button content with icon (no currency symbol, just icon + price)
        this.purchaseButton.innerHTML = `
      <img src="${PremiumCurrencySystem.getIconPath()}" alt="Premium Currency" style="
        width: 24px; 
        height: 24px; 
        margin-right: 8px;
        vertical-align: middle;
      ">
      ${formattedPrice}
    `

        this.purchaseButton.style.cssText = `
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: var(--game-font);
      box-shadow: 0 4px 0 #047857, 0 6px 12px rgba(16, 185, 129, 0.3);
      min-width: 100px;
      align-self: center;
      display: flex;
      align-items: center;
      justify-content: center;
    `

        // Add hover effects
        this.purchaseButton.addEventListener('mouseenter', () => {
            const button = this.purchaseButton as HTMLButtonElement
            if (!button?.disabled) {
                button.style.transform = 'translateY(-2px)'
                button.style.boxShadow = '0 6px 0 #047857, 0 8px 16px rgba(16, 185, 129, 0.4)'
            }
        })

        this.purchaseButton.addEventListener('mouseleave', () => {
            const button = this.purchaseButton as HTMLButtonElement
            if (!button?.disabled) {
                button.style.transform = 'translateY(0)'
                button.style.boxShadow = '0 4px 0 #047857, 0 6px 12px rgba(16, 185, 129, 0.3)'
            }
        })

        // Add click handler
        this.purchaseButton.addEventListener('click', () => {
            this.handlePurchase()
        })

        // Create loading overlay (initially hidden)
        this.loadingOverlay = this.createLoadingOverlay()

        // Assemble the card (no large icon, price with icon on button)
        this.cardElement.appendChild(titleElement)
        this.cardElement.appendChild(descriptionElement)
        this.cardElement.appendChild(this.purchaseButton)
        this.cardElement.appendChild(this.loadingOverlay)

        // Add card hover effect (matching upgrade row style)
        this.cardElement.addEventListener('mouseenter', () => {
            this.cardElement!.style.transform = 'translateY(-2px)'
            this.cardElement!.style.boxShadow = '0 8px 0 #A8C8E1, 0 10px 20px rgba(0, 0, 0, 0.2)'
        })

        this.cardElement.addEventListener('mouseleave', () => {
            this.cardElement!.style.transform = 'translateY(0)'
            this.cardElement!.style.boxShadow = '0 6px 0 #A8C8E1, 0 8px 15px rgba(0, 0, 0, 0.15)'
        })

        return this.cardElement
    }

    /**
     * Create loading overlay with spinning circle
     */
    private createLoadingOverlay(): HTMLElement {
        const overlay = document.createElement('div')
        overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 15px;
      z-index: 10;
    `

        // Loading spinner
        const spinner = document.createElement('div')
        spinner.className = 'loading-spinner'
        spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    `

        // Loading text
        const loadingText = document.createElement('div')
        loadingText.textContent = 'Processing purchase...'
        loadingText.style.cssText = `
      font-size: 14px;
      color: #374151;
      font-weight: 600;
      text-align: center;
      font-family: var(--game-font);
    `

        // Add CSS animation for spinner
        if (!document.querySelector('#spinner-styles')) {
            const styleSheet = document.createElement('style')
            styleSheet.id = 'spinner-styles'
            styleSheet.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `
            document.head.appendChild(styleSheet)
        }

        overlay.appendChild(spinner)
        overlay.appendChild(loadingText)

        return overlay
    }


    /**
     * Handle purchase button click
     */
    private async handlePurchase(): Promise<void> {
        const button = this.purchaseButton as HTMLButtonElement
        if (!button || button.disabled) {
            return
        }

        // Check if item has purchase handler
        if (!this.item.onPurchaseSuccess) {
            await BurgerShopUI.showAlert('Error', 'This item cannot be purchased')
            return
        }

        // Disable button and show loading
        button.disabled = true
        this.showLoadingOverlay()

        try {
            // Check if player has enough currency
            const balance = await PremiumCurrencySystem.getCurrentAmount()
            if (balance < this.item.price) {
                // Directly open the store to purchase more currency
                this.hideLoadingOverlay()
                button.disabled = false
                
                try {
                    await RundotGameAPI.iap.openStore()
                } catch (error) {
                    console.error('Failed to open currency store:', error)
                    await BurgerShopUI.showAlert('Error', 'Unable to open currency store')
                }
                return
            }

            // Spend the currency
            const spendSuccess = await PremiumCurrencySystem.spendCurrency(this.item.price)
            if (!spendSuccess) {
                this.hideLoadingOverlay()
                await BurgerShopUI.showAlert('Error', 'Failed to process payment')
                button.disabled = false
                return
            }

            // Call the item's success callback (what to do after successful payment)
            if (this.item.onPurchaseSuccess) {
                await this.item.onPurchaseSuccess()
            }

            // Purchase successful
            this.hideLoadingOverlay()
            this.showPurchaseSuccess()

            // Auto-remove from shop after success animation completes
            setTimeout(async () => {
                // Import ShopSystem dynamically to avoid circular imports
                const { ShopSystem } = await import('./ShopSystem')
                ShopSystem.getInstance().removeItem(this.item.id)

                // Notify parent component after removal
                if (this.onPurchaseComplete) {
                    this.onPurchaseComplete(this.item.id)
                }
            }, 2000) // Wait for success animation to complete (exactly 2000ms)
        } catch (error) {
            this.hideLoadingOverlay()
            await BurgerShopUI.showAlert('Error', 'An unexpected error occurred')
            button.disabled = false
            console.error('Purchase error:', error)
        }
    }

    /**
     * Show loading overlay
     */
    private showLoadingOverlay(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex'
        }
    }

    /**
     * Hide loading overlay
     */
    private hideLoadingOverlay(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none'
        }
    }


    /**
     * Show purchase success animation
     */
    private showPurchaseSuccess(): void {
        if (!this.cardElement) {
            return
        }
        BurgerShopUI.showSuccessAnimation(this.cardElement)
    }

    /**
     * Get the item associated with this card
     */
    public getItem(): ShopItem {
        return this.item
    }

    /**
     * Cleanup the card element
     */
    public destroy(): void {
        if (this.cardElement) {
            this.cardElement.remove()
            this.cardElement = null
        }
        this.purchaseButton = null
        this.loadingOverlay = null
    }
}
