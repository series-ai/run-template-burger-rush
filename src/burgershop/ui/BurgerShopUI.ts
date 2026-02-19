import "./burgershop-ui.css";

/**
 * Centralized UI utility for consistent Burger Shop UI components
 * Provides DOM element creation functions with CSS classes
 */
export class BurgerShopUI {
  private static cssLoaded = true // CSS is imported at module level

  /**
   * Ensure CSS styles are loaded (CSS is now imported at module level)
   */
  private static ensureCSSLoaded(): void {
    // CSS is imported at the top of the file, so it's always available
    // This method is kept for compatibility but no longer needed
    BurgerShopUI.cssLoaded = true
  }

  /**
   * Create a background overlay element
   */
  public static createOverlay(onClick?: () => void): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const overlay = document.createElement('div')
    overlay.className = 'burger-shop-overlay'
    
    if (onClick) {
      overlay.addEventListener('click', (e) => {
        // Only close if clicking the overlay itself, not its contents
        if (e.target === overlay) {
          onClick()
        }
      })
    }
    
    return overlay
  }

  /**
   * Create a container element (the main panel)
   */
  public static createContainer(): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const container = document.createElement('div')
    container.className = 'burger-shop-container burger-shop-container--modal'
    return container
  }

  /**
   * Create and attach a close button to a container
   */
  public static createCloseButton(container: HTMLElement, onClose: () => void): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const closeButton = document.createElement('button')
    closeButton.className = 'burger-shop-close-button'
    closeButton.innerHTML = '✕'
    closeButton.addEventListener('click', onClose)
    
    container.appendChild(closeButton)
    return closeButton
  }

  /**
   * Create a title element
   */
  public static createTitle(text: string, isLarge: boolean = false): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const title = document.createElement('h2')
    title.className = isLarge 
      ? 'burger-shop-title burger-shop-title--large'
      : 'burger-shop-title'
    title.textContent = text
    
    return title
  }

  /**
   * Create a subtitle element
   */
  public static createSubtitle(text: string): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const subtitle = document.createElement('div')
    subtitle.className = 'burger-shop-subtitle'
    subtitle.innerHTML = text
    
    return subtitle
  }

  /**
   * Create a header container with title and close button
   */
  public static createHeader(title: string, onClose: () => void): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const header = document.createElement('div')
    header.className = 'burger-shop-header'
    
    const titleElement = BurgerShopUI.createTitle(title, true)
    header.appendChild(titleElement)
    
    BurgerShopUI.createCloseButton(header, onClose)
    
    return header
  }

  /**
   * Create a scrollable content area
   */
  public static createContentArea(): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const contentArea = document.createElement('div')
    contentArea.className = 'burger-shop-content-area'
    
    return contentArea
  }

  /**
   * Create a primary button (money button)
   */
  public static createPrimaryButton(text: string, disabled: boolean = false): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const button = document.createElement('button')
    button.className = disabled 
      ? 'burger-shop-button burger-shop-button--disabled'
      : 'burger-shop-button'
    button.innerHTML = text
    
    return button
  }

  /**
   * Create an items grid container
   */
  public static createItemsGrid(itemCount?: number): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const grid = document.createElement('div')
    
    if (itemCount === 1) {
      grid.className = 'burger-shop-items-grid burger-shop-items-grid--single'
    } else if (itemCount === 2) {
      grid.className = 'burger-shop-items-grid burger-shop-items-grid--double'
    } else {
      grid.className = 'burger-shop-items-grid'
    }
    
    return grid
  }

  /**
   * Create an empty state container
   */
  public static createEmptyState(options: {
    icon: string
    title: string
    description: string
    buttonText?: string
    onButtonClick?: () => void
  }): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const container = document.createElement('div')
    container.className = 'burger-shop-empty-state'
    
    const icon = document.createElement('div')
    icon.className = 'burger-shop-empty-state__icon'
    icon.textContent = options.icon
    
    const title = document.createElement('h3')
    title.className = 'burger-shop-empty-state__title'
    title.textContent = options.title
    
    const description = document.createElement('p')
    description.className = 'burger-shop-empty-state__text'
    description.innerHTML = options.description
    
    container.appendChild(icon)
    container.appendChild(title)
    container.appendChild(description)
    
    if (options.buttonText && options.onButtonClick) {
      const button = document.createElement('button')
      button.className = 'burger-shop-debug-button'
      button.textContent = options.buttonText
      button.addEventListener('click', options.onButtonClick)
      container.appendChild(button)
    }
    
    return container
  }

  /**
   * Create a content panel container
   */
  public static createContentPanel(): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const container = document.createElement('div')
    container.className = 'burger-shop-content-panel'
    
    return container
  }

  /**
   * Create a secondary button (ad button style)
   */
  public static createSecondaryButton(text: string, disabled: boolean = false): HTMLElement {
    BurgerShopUI.ensureCSSLoaded()
    
    const button = document.createElement('button')
    button.className = disabled 
      ? 'burger-shop-button burger-shop-button--secondary burger-shop-button--disabled'
      : 'burger-shop-button burger-shop-button--secondary'
    button.innerHTML = text
    
    return button
  }

  /**
   * Show an async alert popup with title, description, and OK button
   * Returns a Promise that resolves when OK is clicked
   */
  public static async showAlert(title: string, description: string): Promise<void> {
    return new Promise<void>((resolve) => {
      BurgerShopUI.ensureCSSLoaded()
      
      // Create popup elements
      const overlay = BurgerShopUI.createOverlay()
      const container = BurgerShopUI.createContainer()
      container.style.width = '400px'
      container.style.padding = '24px'
      
      // Create title
      const titleElement = BurgerShopUI.createTitle(title, true)
      titleElement.style.marginBottom = '16px'
      
      // Create description
      const descriptionElement = document.createElement('div')
      descriptionElement.className = 'burger-shop-subtitle'
      descriptionElement.innerHTML = description
      descriptionElement.style.marginBottom = '24px'
      descriptionElement.style.textAlign = 'center'
      
      // Create OK button
      const okButton = BurgerShopUI.createPrimaryButton('OK')
      okButton.style.width = '100px'
      okButton.style.margin = '0 auto'
      
      // Handle close
      const closePopup = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay)
        }
        resolve()
      }
      
      okButton.addEventListener('click', closePopup)
      
      // Assemble popup
      container.appendChild(titleElement)
      container.appendChild(descriptionElement)
      container.appendChild(okButton)
      overlay.appendChild(container)
      
      // Add to DOM
      document.body.appendChild(overlay)
    })
  }

  /**
   * Show an async options popup with title, description, and custom buttons
   * Each option can have its own action and close behavior
   * Returns a Promise that resolves when any button is clicked
   */
  public static async showOptions(
    title: string, 
    description: string,
    options: Array<{
      text: string
      action?: () => void | Promise<void>
      isPrimary?: boolean
      closeOnClick?: boolean
    }>
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      BurgerShopUI.ensureCSSLoaded()
      
      // Create popup elements
      const overlay = BurgerShopUI.createOverlay()
      const container = BurgerShopUI.createContainer()
      container.style.width = '400px'
      container.style.padding = '24px'
      
      // Create title
      const titleElement = BurgerShopUI.createTitle(title, true)
      titleElement.style.marginBottom = '16px'
      
      // Create description
      const descriptionElement = document.createElement('div')
      descriptionElement.className = 'burger-shop-subtitle'
      descriptionElement.innerHTML = description
      descriptionElement.style.marginBottom = '24px'
      descriptionElement.style.textAlign = 'center'
      
      // Handle close
      const closePopup = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay)
        }
        resolve()
      }
      
      // Create button container for horizontal layout
      const buttonContainer = document.createElement('div')
      buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
        width: 100%;
      `
      
      // Create buttons for each option
      options.forEach((option) => {
        const button = option.isPrimary 
          ? BurgerShopUI.createPrimaryButton(option.text)
          : BurgerShopUI.createSecondaryButton(option.text)
        
        button.style.flex = '1'
        button.style.minWidth = '80px'
        button.style.maxWidth = '150px'
        
        button.addEventListener('click', async () => {
          // Execute custom action if provided
          if (option.action) {
            await option.action()
          }
          
          // Close popup if closeOnClick is true (default behavior)
          if (option.closeOnClick !== false) {
            closePopup()
          }
        })
        
        buttonContainer.appendChild(button)
      })
      
      // Assemble popup
      container.appendChild(titleElement)
      container.appendChild(descriptionElement)
      container.appendChild(buttonContainer)
      overlay.appendChild(container)
      
      // Add to DOM
      document.body.appendChild(overlay)
    })
  }

  /**
   * Show a success animation overlay on a container
   */
  public static showSuccessAnimation(container: HTMLElement, message: string = "Purchase Complete!"): void {
    BurgerShopUI.ensureCSSLoaded()

    // Remove any existing success overlay
    const existing = container.querySelector('.success-overlay')
    if (existing) {
        existing.remove()
    }

    // Add success overlay with backdrop blur and light theme
    const successOverlay = document.createElement('div')
    successOverlay.className = 'success-overlay'
    successOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(5px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: inherit;
      z-index: 20;
      opacity: 0;
      transition: opacity 0.3s ease-out;
    `

    // Animated Checkmark Circle
    const iconContainer = document.createElement('div')
    iconContainer.style.cssText = `
        width: 70px;
        height: 70px;
        min-width: 70px;
        min-height: 70px;
        flex-shrink: 0;
        background: #2ecc71;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 5px 0 #27ae60, 0 10px 20px rgba(46, 204, 113, 0.3);
        margin-bottom: 15px;
        transform: scale(0) rotate(-45deg);
        transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    `

    // SVG Checkmark
    iconContainer.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    `

    // Success Text
    const text = document.createElement('div')
    text.textContent = message
    text.style.cssText = `
        font-family: var(--game-font);
        font-size: 22px;
        font-weight: 700;
        color: #2c3e50;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.4s ease-out 0.2s;
        text-align: center;
        padding: 0 20px;
    `

    successOverlay.appendChild(iconContainer)
    successOverlay.appendChild(text)
    container.appendChild(successOverlay)

    // Trigger animations
    requestAnimationFrame(() => {
        successOverlay.offsetHeight // force reflow
        successOverlay.style.opacity = '1'
        iconContainer.style.transform = 'scale(1) rotate(0deg)'
        text.style.transform = 'translateY(0)'
        text.style.opacity = '1'
    })

    // Remove after animation
    setTimeout(() => {
        successOverlay.style.opacity = '0'
        // Slide down slightly on exit
        iconContainer.style.transform = 'scale(0.8) translateY(10px)'
        
        setTimeout(() => {
            if (successOverlay.parentNode) {
                successOverlay.parentNode.removeChild(successOverlay)
            }
        }, 300)
    }, 1800)
  }

  /**
   * Create a complete popup with overlay and container
   */
  public static createPopup(options: {
    title: string
    onClose: () => void
    width?: string
    showCloseButton?: boolean
  }): { overlay: HTMLElement; container: HTMLElement; contentArea: HTMLElement } {
    BurgerShopUI.ensureCSSLoaded()
    
    const overlay = BurgerShopUI.createOverlay(options.onClose)
    const container = BurgerShopUI.createContainer()
    
    // Apply custom width if provided
    if (options.width) {
      container.style.width = options.width
    }
    
    const header = BurgerShopUI.createHeader(options.title, options.onClose)
    const contentArea = BurgerShopUI.createContentArea()
    
    container.appendChild(header)
    container.appendChild(contentArea)
    overlay.appendChild(container)
    
    return { overlay, container, contentArea }
  }

  // =====================================================
  // DEPRECATED CSS STRING FUNCTIONS - Use DOM utilities above instead
  // These are kept for backward compatibility during transition
  // =====================================================

  /**
   * Standard modal/popup styling that matches upgrade panels
   * @deprecated Use BurgerShopUI.createContainer() instead
   */
  public static getModalStyle(): string {
    return `
      background: #5A9FD4;
      border-radius: 25px;
      box-shadow: 0 5px 0 #4A7BA7, 0 10px 20px rgba(0, 0, 0, 0.2);
      font-family: var(--game-font);
      font-weight: 600;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    `
  }

  /**
   * Standard backdrop style for full-screen overlays
   * @deprecated Use BurgerShopUI.createOverlay() instead
   */
  public static getBackdropStyle(): string {
    return `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
    `
  }

  /**
   * Standard title style for modals/popups
   * @deprecated Use BurgerShopUI.createTitle() instead
   */
  public static getTitleStyle(): string {
    return `
      margin: 0 0 8px 0;
      color: white;
      font-size: 24px;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      font-family: var(--game-font);
      text-align: center;
    `
  }

  /**
   * Standard subtitle/description style
   * @deprecated Use BurgerShopUI.createSubtitle() instead
   */
  public static getSubtitleStyle(): string {
    return `
      margin: 0 0 16px 0;
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      font-family: var(--game-font);
      line-height: 1.3;
      text-align: center;
    `
  }

  /**
   * Standard close button style
   * @deprecated Use BurgerShopUI.createCloseButton() instead
   */
  public static getCloseButtonStyle(): string {
    return `
      background: #FF6B6B;
      width: 35px;
      height: 35px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      font-weight: bold;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      font-family: var(--game-font);
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
      box-shadow: 0 5px 0 #C0392B;
      border: none;
      position: absolute;
      top: 15px;
      right: 15px;
      transform-origin: center;
    `
  }

  /**
   * Create a popup with consistent styling (old version)
   * @deprecated Use BurgerShopUI.createPopup() instead
   */
  public static createPopupOld(options: {
    title: string
    content: string
    onClose?: () => void
    width?: string
    padding?: string
    showCloseButton?: boolean
  }): HTMLElement {
    // Create backdrop
    const backdrop = document.createElement('div')
    backdrop.style.cssText = this.getBackdropStyle()

    // Create modal content
    const modal = document.createElement('div')
    modal.style.cssText = `
      ${this.getModalStyle()}
      width: ${options.width || '400px'};
      max-height: 600px;
      overflow: visible;
      padding: ${options.padding || '18px'};
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    `

    // Create close button (only if requested)
    let closeButton: HTMLElement | null = null
    const closeModal = () => {
      if (document.body.contains(backdrop)) {
        document.body.removeChild(backdrop)
      }
      if (options.onClose) {
        options.onClose()
      }
    }

    if (options.showCloseButton !== false) {
      closeButton = document.createElement('button')
      closeButton.innerHTML = '✕'
      closeButton.style.cssText = this.getCloseButtonStyle()
      
      // Add close button hover effects
      closeButton.addEventListener('mouseenter', () => {
        closeButton!.style.transform = 'scale(1.1)'
        closeButton!.style.boxShadow = '0 8px 0 #C0392B, 0 10px 20px rgba(255, 107, 107, 0.4)'
      })
      
      closeButton.addEventListener('mouseleave', () => {
        closeButton!.style.transform = 'scale(1)'
        closeButton!.style.boxShadow = '0 5px 0 #C0392B'
      })
      
      closeButton.addEventListener('mousedown', () => {
        closeButton!.style.transform = 'scale(0.9)'
        closeButton!.style.boxShadow = '0 2px 0 #C0392B'
      })
      
      closeButton.addEventListener('mouseup', () => {
        closeButton!.style.transform = 'scale(1.1)'
        closeButton!.style.boxShadow = '0 8px 0 #C0392B, 0 10px 20px rgba(255, 107, 107, 0.4)'
      })

      closeButton.addEventListener('click', closeModal)
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal()
        }
      })
    }

    // Create title
    const title = document.createElement('h2')
    title.textContent = options.title
    title.style.cssText = this.getTitleStyle()

    // Create content container
    const contentDiv = document.createElement('div')
    contentDiv.innerHTML = options.content
    contentDiv.style.cssText = `
      width: 100%;
      flex: 1;
    `

    // Assemble modal
    if (closeButton) {
      modal.appendChild(closeButton)
    }
    modal.appendChild(title)
    modal.appendChild(contentDiv)
    backdrop.appendChild(modal)

    return backdrop
  }

  /**
   * Standard button style for primary actions (money buttons)
   * @deprecated Use BurgerShopUI.createPrimaryButton() instead
   */
  public static getPrimaryButtonStyle(disabled: boolean = false): string {
    if (disabled) {
      return `
        background: #95A5A6;
        color: white;
        padding: 8px 12px;
        border-radius: 15px;
        cursor: not-allowed;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 70px;
        justify-content: center;
        box-shadow: 0 3px 0 #7F8C8D;
        font-family: var(--game-font);
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        border: none;
        transform-origin: center;
      `
    }

    return `
      background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 15px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 70px;
      justify-content: center;
      box-shadow: 0 4px 0 #16a34a;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      font-family: var(--game-font);
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
      border: none;
      transform-origin: center;
    `
  }
}
