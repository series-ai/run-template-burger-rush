import { UISystem } from "@series-inc/rundot-3d-engine/systems"

/**
 * Money Change Indicator - Singleton System
 * Shows current money when players are in purchase areas or gain money
 * Appears fast, disappears slowly, with special styling for $0
 * Uses normal HUD UI like the money system, positioned center-right
 */
export class MoneyChangeIndicator {
  private static instance: MoneyChangeIndicator | null = null
  
  /** Set to true to disable the money change indicator entirely */
  public static disabled: boolean = true
  
  private uiElement: any = null // HUD element from UISystem
  private currentOpacity: number = 0.0
  private fadeInSpeed: number = 8.0 // Fast appearance
  private fadeOutSpeed: number = 2.0 // Slow disappearance
  private lastMoney: number = -1 // Track money changes for updates
  private updateInterval: any = null
  private moneySystemInstance: any = null // Reference to MoneySystem instance

  // Simple timestamp-based state
  private isShowing: boolean = false // External show/hide state
  private fadeTimestamp: number = 0 // When to start fading (0 = hidden)
  private readonly HOLD_DURATION = 1.0 // How long to hold before fading
  private readonly FADE_DURATION = 0.5 // How long the fade takes

  public readonly id: string

  private constructor(moneySystem?: any) {
    this.id = `money_indicator_${Math.random().toString(36).substr(2, 9)}`
    
    // Set this as the singleton instance
    if (MoneyChangeIndicator.instance) {
      console.warn("MoneyChangeIndicator instance already exists!")
    }
    MoneyChangeIndicator.instance = this
    this.moneySystemInstance = moneySystem

    // Initialize UI system
    UISystem.initialize()
    
    // Add CSS keyframes for $0 animation
    this.addShakeAnimation()
    
    // Set up money listener if MoneySystem provided
    if (moneySystem) {
      this.setupMoneyListener(moneySystem)
    }
    
    // Start update loop for fade animations
    this.startUpdateLoop()
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(moneySystem?: any): MoneyChangeIndicator {
    if (!MoneyChangeIndicator.instance) {
      MoneyChangeIndicator.instance = new MoneyChangeIndicator(moneySystem)
    }
    return MoneyChangeIndicator.instance
  }

  /**
   * Add CSS for money icon styling (match MoneyUI)
   */
  private addShakeAnimation(): void {
    // Only add once
    if (document.getElementById('money-change-shake-style')) return
    
    const style = document.createElement('style')
    style.id = 'money-change-shake-style'
    style.textContent = `
      .ui-money-change-indicator .money-display-icon {
        width: 30px !important;
        height: 30px !important;
        background-image: url('assets/cozy_game_general/money_icon.png') !important;
        background-size: contain !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        display: inline-block !important;
        flex-shrink: 0 !important;
        filter: brightness(1.1) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3)) !important;
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Setup money change listener - simplified
   */
  private setupMoneyListener(moneySystem: any): void {
    // Initialize with current display money to avoid showing on startup
    this.lastMoney = moneySystem.constructor.getDisplayMoney()
  }


  /**
   * Start the update loop for fade animations
   */
  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.update(1/60) // Approximate 60fps
    }, 16) // ~60fps
  }



  /**
   * Update the indicator - simple timestamp-based logic
   */
  public update(deltaTime: number): void {
    if (!this.moneySystemInstance) return
    if (MoneyChangeIndicator.disabled) return

    // Get current money values
    const displayMoney = this.moneySystemInstance.constructor.getDisplayMoney()

    // Internally trigger show when money changes (but not on first frame)
    if (this.lastMoney !== -1 && this.lastMoney !== displayMoney) {
      this.lastMoney = displayMoney
      this.triggerShow() // Internal show trigger
    } else if (this.lastMoney === -1) {
      // First update - just set the initial value, don't show
      this.lastMoney = displayMoney
    }

    // Calculate target opacity based on showing state and timestamp
    const currentTime = performance.now() / 1000 // Convert to seconds
    let targetOpacity = 0.0
    
    if (this.isShowing) {
      // Showing - stay at full opacity
      targetOpacity = 0.9
    } else if (this.fadeTimestamp > 0) {
      // Not showing - check if we're in fade period
      const timeSinceFadeStart = currentTime - this.fadeTimestamp
      
      if (timeSinceFadeStart < this.HOLD_DURATION) {
        // Still in hold period
        targetOpacity = 0.9
      } else if (timeSinceFadeStart < this.HOLD_DURATION + this.FADE_DURATION) {
        // Fading out
        const fadeProgress = (timeSinceFadeStart - this.HOLD_DURATION) / this.FADE_DURATION
        targetOpacity = 0.9 * (1 - fadeProgress)
      } else {
        // Fade complete, fully hidden
        targetOpacity = 0.0
        this.fadeTimestamp = 0 // Reset timestamp
      }
    }

    // Smoothly interpolate to target opacity
    if (this.currentOpacity < targetOpacity) {
      // Fading in (fast)
      this.currentOpacity = Math.min(
        this.currentOpacity + this.fadeInSpeed * deltaTime,
        targetOpacity
      )
    } else if (this.currentOpacity > targetOpacity) {
      // Fading out (slow)
      this.currentOpacity = Math.max(
        this.currentOpacity - this.fadeOutSpeed * deltaTime,
        targetOpacity
      )
    }

    // Update content and opacity if visible
    const isVisible = this.currentOpacity > 0.01
    if (isVisible) {
      // Create UI element if needed
      if (!this.uiElement) {
        this.createUIElement()
      }
      
      if (this.uiElement && this.uiElement.element) {
        this.uiElement.element.innerHTML = this.createMoneyContent(displayMoney)
        this.uiElement.element.style.opacity = this.currentOpacity.toString()
        
        // Change text color to light red when at $0
        const actualMoney = this.moneySystemInstance.constructor.getMoney()
        const textColor = actualMoney === 0 ? '#ff6b6b' : 'white'
        this.uiElement.element.style.color = textColor
      }
    } else if (this.uiElement && this.uiElement.element) {
      // Ensure opacity is set to 0 when not visible
      this.uiElement.element.style.opacity = '0'
    }
  }

  /**
   * Internal method to trigger show behavior (used by money change detection)
   * Does NOT set isShowing - just starts the fade timer
   */
  private triggerShow(): void {
    if (MoneyChangeIndicator.disabled) return
    this.fadeTimestamp = performance.now() / 1000 // Start fade countdown
    
    // Create UI element if needed
    if (!this.uiElement) {
      this.createUIElement()
    }
  }

  /**
   * Show the money indicator (external API - for purchase areas)
   * Keeps indicator visible while showing is true
   */
  public show(): void {
    if (MoneyChangeIndicator.disabled) return
    this.isShowing = true
    this.fadeTimestamp = performance.now() / 1000 // Update fade start time
    
    // Create UI element if needed
    if (!this.uiElement) {
      this.createUIElement()
    }
  }

  /**
   * Hide the money indicator (external API - for purchase areas)
   * Triggers fade after 1 second hold duration
   */
  public hide(): void {
    this.isShowing = false
    this.fadeTimestamp = performance.now() / 1000 // Start fade countdown
  }

  /**
   * Static convenience methods
   */
  public static show(): void {
    const instance = MoneyChangeIndicator.getInstance()
    if (instance) {
      instance.show()
    }
  }

  public static hide(): void {
    const instance = MoneyChangeIndicator.getInstance()
    if (instance) {
      instance.hide()
    }
  }

  /**
   * Create the HUD UI element for the money display with responsive positioning
   */
  private createUIElement(): void {
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }

    const displayMoney = this.moneySystemInstance ? this.moneySystemInstance.constructor.getDisplayMoney() : 0
    this.lastMoney = displayMoney // Update tracking
    
    // Create element that will be positioned inside UISystem container for safe area support
    const element = document.createElement('div')
    element.id = 'money-change-indicator'
    element.className = 'ui-element ui-money-change-indicator'
    element.innerHTML = this.createMoneyContent(displayMoney)
    
    // Simplified styling - match MoneyUI size with subtle background
    // Use fixed pixel offset from center so it looks consistent on all screen sizes
    element.style.cssText = `
      position: fixed !important;
      top: calc(50% - 15px) !important;
      left: calc(50% + 150px) !important;
      transform: translate(-50%, -50%) !important;
      color: white !important;
      background: rgba(0, 0, 0, 0.40) !important;
      padding: 6px 12px !important;
      border-radius: 20px !important;
      font-weight: 700 !important;
      font-size: 22px !important;
      z-index: 9998 !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      font-family: var(--game-font) !important;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3) !important;
      transform-origin: center !important;
      opacity: 0 !important;
      pointer-events: none !important;
    `
    
    // Append to world container (ignores safe areas) or body for consistent positioning
    const worldContainer = document.getElementById("ui-world-system-three")
    if (worldContainer) {
      worldContainer.appendChild(element)
    } else {
      // Fallback to body if UISystem not initialized
      document.body.appendChild(element)
    }
    
    // Create wrapper object matching UISystem interface
    this.uiElement = {
      id: 'money-change-indicator',
      type: 'hud',
      element: element,
      show: () => { element.style.display = 'flex' },
      hide: () => { element.style.display = 'none' },
      remove: () => { element.remove() }
    }
  }

  /**
   * Create the money display HTML content (with icon like money system)
   */
  private createMoneyContent(money: number): string {
    // Just the content, styling handled separately
    return `<span class="money-display-icon"></span>${Math.floor(money).toLocaleString()}`
  }


  /**
   * Clean up the UI element and stop updates
   */
  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }
    
    this.moneySystemInstance = null
    MoneyChangeIndicator.instance = null
  }
}
