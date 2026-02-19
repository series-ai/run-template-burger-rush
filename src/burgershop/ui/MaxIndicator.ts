import * as THREE from "three"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"

export interface MaxIndicatorConfig {
  heightOffset?: number // How far above the entity to position the indicator
}

/**
 * A reusable MAX indicator for Three.js that displays above entities when they are full
 * Uses HTML/CSS-based world-space UI for better performance and styling
 *
 * @example
 * // For player inventory
 * const maxIndicator = new MaxIndicator({
 *   heightOffset: 3.0
 * });
 * maxIndicator.attachTo(playerGameObject, camera);
 *
 * // Show/hide as needed
 * maxIndicator.show();
 * maxIndicator.hide();
 *
 * // Clean up when done
 * maxIndicator.dispose();
 */
export class MaxIndicator {
  private worldPosition: THREE.Vector3 = new THREE.Vector3()
  private uiElement: any = null // UIWorldElement from UISystem
  private config: Required<MaxIndicatorConfig>
  private camera: THREE.Camera | null = null
  private isVisible: boolean = false
  private parentObject: any = null // Track parent for recreation

  public readonly id: string

  constructor(config: MaxIndicatorConfig = {}) {
    this.id = `max_indicator_${Math.random().toString(36).substr(2, 9)}`

    // Set defaults for config
    this.config = {
      heightOffset: config.heightOffset ?? 3.0,
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
    // Don't create immediately - create/destroy as needed
    // MaxIndicator attached
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
      // Position updated silently
    }
  }

  /**
   * Create the HTML/CSS UI element
   */
  private createUIElement(): void {
    if (!this.camera) {
      // No camera available for max indicator
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

    // UI will be scaled by the unified UISystem scaling

    const content = `
      <div
        class="max-indicator-lite"
        style="
          background: linear-gradient(135deg, rgba(239,68,68,0.7) 0%, rgba(220,38,38,0.85) 100%);
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 3px 0 rgba(185,28,28,0.5), 0 5px 12px rgba(239,68,68,0.25);
          transform-origin: center;
          animation: bounce-pulse 2s infinite;
          font-family: var(--game-font);
          white-space: nowrap;
        "
      >
        <span style="font-size: 16px; margin-right: 2px;">⚠️</span>
        <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">MAX</span>
      </div>
    `

    // Creating UI at world position

    this.uiElement = UISystem.createWorldSpaceUI(
      this.id,
      content,
      this.worldPosition,
      this.camera,
      {
        className: "ui-max-indicator-lite",
        offset: { x: 0, y: -30 },
      },
    )

    // UI element created
  }

  /**
   * Update the height offset and recalculate position
   */
  public updateHeightOffset(offset: number, parentObject?: any): void {
    this.config.heightOffset = offset

    if (parentObject) {
      this.updateWorldPosition(parentObject)
      if (this.uiElement) {
        this.uiElement.worldPosition.copy(this.worldPosition)
      }
    }
  }

  /**
   * Update the indicator position (call this in your update loop if the parent moves)
   */
  public update(parentObject: any, camera: THREE.Camera): void {
    this.camera = camera
    this.parentObject = parentObject // Keep parent reference updated

    if (this.isVisible && this.uiElement) {
      this.updateWorldPosition(parentObject)
      this.uiElement.worldPosition.copy(this.worldPosition)

      // Debug position every 120 frames (about 2 seconds at 60fps)
      if (Math.random() < 0.008) {
        // ~1 in 125 chance
        // Position updated
      }
    }
  }

  /**
   * Show the indicator (CREATE/DESTROY pattern)
   */
  public show(): void {
    if (!this.isVisible) {
      this.createUIElement()
      this.isVisible = true
      // MAX indicator created
    }
  }

  /**
   * Hide the indicator (CREATE/DESTROY pattern)
   */
  public hide(): void {
    if (this.isVisible && this.uiElement) {
      this.uiElement.remove() // Completely remove from DOM
      this.uiElement = null
      this.isVisible = false
      // MaxIndicator destroyed
    }
  }
  
  /**
   * Check if the indicator is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Dispose of the MAX indicator and clean up resources
   */
  public dispose(): void {
    if (this.uiElement) {
      this.uiElement.remove()
      this.uiElement = null
    }
    this.isVisible = false
    this.camera = null
    this.parentObject = null
    // MaxIndicator disposed
  }
}
