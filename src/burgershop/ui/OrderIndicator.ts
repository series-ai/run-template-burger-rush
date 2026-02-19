import * as THREE from "three"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { GameObject } from "@series-inc/rundot-3d-engine"
import { ItemTypes } from "@game/inventory"

export interface OrderIndicatorConfig {
  burgerCount: number
  heightOffset?: number // How far above the entity to position the indicator
  itemIcon?: string // The emoji icon to display (defaults to 🍔 burger)
}

/**
 * Three.js order indicator showing burger count above customer (like MaxIndicator)
 * Uses HTML/CSS-based world-space UI for better performance and styling
 */
export class OrderIndicator {
  private worldPosition: THREE.Vector3 = new THREE.Vector3()
  private uiElement: any = null // UIWorldElement from UISystem
  private config: Required<OrderIndicatorConfig>
  private camera: THREE.Camera | null = null
  private isVisible: boolean = false
  private parentObject: any = null // Track parent for recreation
  private isShowingNoSeatsWarning: boolean = false

  public readonly id: string

  constructor(config: OrderIndicatorConfig) {
    this.id = `order_indicator_${Math.random().toString(36).substr(2, 9)}`

    // Set defaults for config
    this.config = {
      burgerCount: config.burgerCount,
      heightOffset: config.heightOffset ?? 3.0,
      itemIcon: config.itemIcon ?? "🍔",
    }

    // Initialize UI system if needed
    UISystem.initialize()
  }

  /**
   * Attach the indicator to a GameObject and camera
   */
  public attachTo(parentObject: any, camera: THREE.Camera): void {
    this.camera = camera
    this.parentObject = parentObject // Store parent for later recreation
    this.updateWorldPosition(parentObject)
    // Order indicator created
  }

  /**
   * Update the world position based on parent object position
   */
  private updateWorldPosition(parentObject: any): void {
    if (parentObject) {
      // Get world position instead of local position
      if (parentObject.getWorldPosition) {
        // For Three.js objects
        parentObject.getWorldPosition(this.worldPosition)
      } else if (parentObject.position) {
        // Fallback for simple position objects
        this.worldPosition.copy(parentObject.position)
      }

      this.worldPosition.y += this.config.heightOffset
    }
  }

  /**
   * Create the HTML/CSS UI element
   */
  private createUIElement(): void {
    if (!this.camera) {
      // No camera available for order indicator
      return
    }

    if (this.uiElement) {
      // UI element already exists, removing first
      this.uiElement.remove()
      this.uiElement = null
    }

    // Update position before creating
    if (this.parentObject) {
      this.updateWorldPosition(this.parentObject)
    }

    // Create content with burger icon and count with mobile game style

    const noSeatsWarningContent = `
        <div class="order-content-lite" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
          <span style="font-size: 24px;">⚠️</span>
          <span style="font-size: 18px; font-weight: 700;">No seats</span>
        </div>
    `

    const burgerCountContent = `
        <div class="order-content-lite" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
          <span style="font-size: 24px;">${this.config.itemIcon}</span>
          <span style="font-size: 18px; font-weight: 700;">${this.config.burgerCount}</span>
        </div>
    `

    let contentToDisplay: string
    if (this.config.burgerCount > 0) {
      contentToDisplay = burgerCountContent
    } else if (this.isShowingNoSeatsWarning) {
      contentToDisplay = noSeatsWarningContent
    } else {
      contentToDisplay = ''
    }

    const content = `
      <div
        class="order-indicator-lite"
        style="
          background: linear-gradient(135deg, rgba(139,92,246,0.7) 0%, rgba(124,58,237,0.85) 100%);
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 16px;
          box-shadow: 0 3px 0 rgba(109,40,217,0.5), 0 5px 12px rgba(139,92,246,0.25);
          transform-origin: center;
          font-family: var(--game-font);
          white-space: nowrap;
        "
      >
      ${contentToDisplay}    
      </div>
    `

    this.uiElement = UISystem.createWorldSpaceUI(
      this.id,
      content,
      this.worldPosition,
      this.camera,
      {
        className: "ui-order-indicator-lite",
        offset: { x: 0, y: -30 },
      },
    )
  }

  /**
   * Update the indicator position (call this in your update loop if the parent moves)
   */
  public update(parentObject: GameObject, camera: THREE.Camera): void {
    this.camera = camera
    this.parentObject = parentObject // Keep parent reference updated

    if (this.isVisible && this.uiElement) {
      this.updateWorldPosition(parentObject)
      this.uiElement.worldPosition.copy(this.worldPosition)
    }
  }

  /**
   * Show the indicator (CREATE pattern)
   */
  public show(): void {
    if (!this.isVisible) {
      this.createUIElement()
      this.isVisible = true
    }
  }

  /**
   * Hide the indicator (DESTROY pattern)
   */
  public hide(): void {
    if (this.isVisible && this.uiElement) {
      this.uiElement.remove() // Completely remove from DOM
      this.uiElement = null
      this.isVisible = false
    }
  }

  /**
   * Check if the indicator is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Update burger count and refresh display
   */
  public updateBurgerCount(count: number): void {
    this.config.burgerCount = count
    if (this.isVisible) {
      // Recreate with new count
      this.hide()
      this.show()
    }
  }

  /**
   * Update item icon and refresh display
   */
  public updateItemIcon(itemType: string): void {
    switch (itemType) {
      case ItemTypes.BURGER:
        this.config.itemIcon = "🍔"
        break
      case ItemTypes.SHAKE:
        this.config.itemIcon = "🥤"
        break
      default:
        this.config.itemIcon = "🍔"
        break
    }

    if (this.isVisible) {
      // Recreate with new icon
      this.hide()
      this.show()
    }
  }

  /**
   * Dispose of the order indicator and clean up resources
   */
  public dispose(): void {
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }
    this.isVisible = false
    this.camera = null
    this.parentObject = null
    // OrderIndicator disposed
  }

  public showNoSeatsWarning() {
    if (this.isShowingNoSeatsWarning) {
      return
    }
    this.isShowingNoSeatsWarning = true
    console.log("[DEBUG] Showing no seats available warning")
    if (this.isVisible) {
      // Recreate with new count
      this.hide()
      this.show()
    }
  }

  public hideNoSeatsWarning() {
    if (!this.isShowingNoSeatsWarning) {
      return
    }
    this.isShowingNoSeatsWarning = false
    console.log("[DEBUG] Hiding no seats available warning")
    if (this.isVisible) {
      // Recreate with new count
      this.hide()
      this.show()
    }
  }
}
