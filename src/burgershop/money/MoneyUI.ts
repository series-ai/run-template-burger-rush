import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { MoneySystem } from "./MoneySystem"

/**
 * MoneyUI - Handles the main money display in top-right corner
 * Clean separation from UISystem to keep UISystem generic
 */
export class MoneyUI {
  private static instance: MoneyUI | null = null
  private uiElement: any = null
  private lastMoneyAmount: number = -1

  private constructor() {
    // Initialize UI system
    UISystem.initialize()

    // Add money icon styles
    this.addMoneyIconStyles()

    // Register with MoneySystem to avoid circular imports
    MoneySystem.setMoneyUI(this)

    // Create initial display
    this.updateMoneyDisplay()
  }

  /**
   * Initialize the MoneyUI singleton
   */
  public static initialize(): MoneyUI {
    if (!MoneyUI.instance) {
      MoneyUI.instance = new MoneyUI()
    }
    return MoneyUI.instance
  }

  /**
   * Get existing instance
   */
  public static getInstance(): MoneyUI | null {
    return MoneyUI.instance
  }

  /**
   * Update the main money display
   */
  public updateMoneyDisplay(): void {
    const amount = MoneySystem.getDisplayMoney()

    if (this.uiElement) {
      // Check if money increased for juice animation
      const shouldJuice =
        this.lastMoneyAmount >= 0 && amount > this.lastMoneyAmount

      // Update existing money display
      this.uiElement.element.innerHTML = `<span class="money-display-icon"></span>${amount.toLocaleString()}`

      // Apply juice animation if money increased
      if (shouldJuice) {
        // Remove any existing animation
        this.uiElement.element.style.animation = "none"
        // Force reflow
        this.uiElement.element.offsetHeight
        // Apply juice animation
        this.uiElement.element.style.animation =
          "ui-juice 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)"
      }

      this.lastMoneyAmount = amount
    } else {
      // Create new money display
      const money = UISystem.createHUD(
        "money-display",
        `<span class="money-display-icon"></span>${amount.toLocaleString()}`,
        { x: window.innerWidth - 150, y: 20 }, // Top-right positioning
      )
      money.element.classList.add("ui-money-display")

      // Style with consistent colors from MoneySystem
      const colors = MoneySystem.MONEY_COLORS
      money.element.style.cssText += `
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        left: auto !important;
        background: ${colors.GREEN_GRADIENT} !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 25px !important;
        font-weight: 700 !important;
        font-size: 22px !important;
        box-shadow: 0 6px 0 ${colors.GREEN_SHADOW}, 0 8px 20px rgba(34, 197, 94, 0.4) !important;
        z-index: 9999 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        font-family: var(--game-font) !important;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3) !important;
        transform-origin: center !important;
      `

      this.uiElement = money
      this.lastMoneyAmount = amount
    }
  }

  /**
   * Add money icon styles to document head
   */
  private addMoneyIconStyles(): void {
    if (!document.querySelector("#money-display-icon-style")) {
      const iconStyle = document.createElement("style")
      iconStyle.id = "money-display-icon-style"
      iconStyle.textContent = `
        .money-display-icon {
          width: 24px;
          height: 24px;
          background-image: url('assets/cozy_game_general/money_icon.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          display: inline-block;
          filter: brightness(1.1);
        }
      `
      document.head.appendChild(iconStyle)
    }
  }

  /**
   * Hide the money display
   */
  public hide(): void {
    if (this.uiElement && this.uiElement.element) {
      this.uiElement.element.style.display = "none"
    }
  }

  /**
   * Show the money display
   */
  public show(): void {
    if (this.uiElement && this.uiElement.element) {
      this.uiElement.element.style.display = "flex"
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }

    MoneyUI.instance = null
  }
}
