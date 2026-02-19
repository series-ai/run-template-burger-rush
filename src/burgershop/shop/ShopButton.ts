import { UISystem } from '@series-inc/rundot-3d-engine/systems'

/**
 * Shop button component that appears on the side of the screen
 * Opens the shop modal when clicked
 * Uses UISystem for proper inset handling and consistent styling
 */
export class ShopButton {
  private static instance: ShopButton | null = null
  private uiElement: any = null
  private isVisible: boolean = false
  private onClickCallback: (() => void) | null = null

  private constructor() {}

  public static getInstance(): ShopButton {
    if (!ShopButton.instance) {
      ShopButton.instance = new ShopButton()
    }
    return ShopButton.instance
  }

  /**
   * Initialize and show the shop button
   */
  public initialize(onClick: () => void): void {
    this.onClickCallback = onClick
    this.createButton()
    this.show()
  }

  /**
   * Create the shop button element using UISystem
   */
  private createButton(): void {
    if (this.uiElement) {
      return
    }

    // Ensure UISystem is initialized
    UISystem.initialize()

    // Add shop button styles to document head (consistent with MoneyUI pattern)
    this.addShopButtonStyles()

    // Create button using UISystem.createHUD for proper inset handling
    const buttonContent = `🛒`

    // Position on right side, below money display
    this.uiElement = UISystem.createHUD(
      'shop-button',
      buttonContent,
      { x: window.innerWidth - 90, y: 120 }, // Right side, below money display
    )

    // Add shop button specific class
    this.uiElement.element.classList.add('ui-shop-button')

    // Style with consistent UISystem approach (like MoneyUI)  
    // Use cssText = (not +=) to completely override UISystem defaults
    this.uiElement.element.style.cssText = `
      position: absolute !important;
      top: 120px !important;
      right: 20px !important;
      left: auto !important;
      width: 60px !important;
      height: 60px !important;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
      color: white !important;
      border-radius: 50% !important;
      box-shadow: 0 4px 0 #6d28d9, 0 8px 15px rgba(139, 92, 246, 0.3) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 1001 !important;
      pointer-events: auto !important;
      font-family: var(--game-font) !important;
      font-size: 28px !important;
      font-weight: 600 !important;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
      opacity: 0.9 !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      outline: none !important;
      line-height: 60px !important;
      text-align: center !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
      min-width: 60px !important;
      min-height: 60px !important;
      max-width: 60px !important;
      max-height: 60px !important;
    `

    // Add click handler
    this.uiElement.element.addEventListener('click', () => {
      if (this.onClickCallback) {
        this.onClickCallback()
      }
    })
  }

  /**
   * Add shop button styles to document head (consistent with MoneyUI pattern)
   */
  private addShopButtonStyles(): void {
    if (!document.querySelector('#shop-button-icon-style')) {
      const iconStyle = document.createElement('style')
      iconStyle.id = 'shop-button-icon-style'
      iconStyle.textContent = `
        .ui-shop-button:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 0 #6d28d9, 0 12px 20px rgba(139, 92, 246, 0.4) !important;
        }
        .ui-shop-button:active {
          transform: translateY(1px) !important;
          box-shadow: 0 2px 0 #6d28d9, 0 4px 10px rgba(139, 92, 246, 0.3) !important;
        }
        
        
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .ui-shop-button {
            width: 50px !important;
            height: 50px !important;
            right: 15px !important;
            top: 100px !important;
            font-size: 24px !important;
          }
        }
      `
      document.head.appendChild(iconStyle)
    }
  }

  /**
   * Show the shop button
   */
  public show(): void {
    if (this.uiElement && !this.isVisible) {
      this.uiElement.show()
      this.isVisible = true
    }
  }

  /**
   * Hide the shop button
   */
  public hide(): void {
    if (this.uiElement && this.isVisible) {
      this.uiElement.hide()
      this.isVisible = false
    }
  }


  /**
   * Cleanup the button
   */
  public destroy(): void {
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }
    this.isVisible = false
    this.onClickCallback = null
  }
}
