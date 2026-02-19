import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { CameraManager } from "../camera"
import { PlayerComponent } from "../PlayerComponent"
import { InitialShopPurchase } from "../InitialShopPurchase"
import { PrefabInstance } from "../prefabs"

/**
 * Title screen component that displays the game title and handles
 * the startup camera transition before enabling gameplay.
 * 
 * Shows:
 * - "Burger Shop Rush" title at top left
 * - "Click to continue" prompt at bottom center (flashing)
 * 
 * On click:
 * - Hides UI
 * - Animates camera to gameplay position
 * - Enables player movement
 * - Animates out InitialShopPurchase exterior if already acquired
 */
export class TitleScreen extends Component {
  private cameraManager: CameraManager
  private player: GameObject
  private initialShopPurchase: InitialShopPurchase
  private titleCameraPosition: THREE.Vector3
  private titleCameraQuaternion: THREE.Quaternion
  private onComplete?: () => void

  // UI elements
  private overlayElement: HTMLDivElement | null = null
  private titleElement: HTMLDivElement | null = null
  private promptElement: HTMLDivElement | null = null
  private debugElement: HTMLDivElement | null = null

  // State
  private isTransitioning: boolean = false

  // Animation settings
  private static readonly CAMERA_TRANSITION_DURATION = 1 // seconds

  constructor(
    cameraManager: CameraManager,
    player: GameObject,
    initialShopPurchase: InitialShopPurchase,
    cameraPrefabInstance: PrefabInstance,
    onComplete?: () => void
  ) {
    super()
    this.cameraManager = cameraManager
    this.player = player
    this.initialShopPurchase = initialShopPurchase
    this.onComplete = onComplete

    // Hardcoded camera position and rotation (captured from free camera debug)
    // Position: -36, 18, -58
    // Rotation (YXZ degrees): X=-15° (pitch), Y=215° (yaw), Z=0° (roll)
    this.titleCameraPosition = new THREE.Vector3(-38, 20, -58)
    
    // Create quaternion from euler angles (converting degrees to radians)
    // Using YXZ order: Y = horizontal turn, X = pitch up/down, Z = roll
    const titleEuler = new THREE.Euler( 
      THREE.MathUtils.degToRad(-10),   // X = pitch (tilt up/down)
      THREE.MathUtils.degToRad(215),  // Y = yaw (horizontal turn)
      THREE.MathUtils.degToRad(0),    // Z = roll (horizon tilt)
      "YXZ"
    )
    this.titleCameraQuaternion = new THREE.Quaternion().setFromEuler(titleEuler)
    
    // Debug log
    console.log("TitleScreen: Using hardcoded camera - pos:", this.titleCameraPosition.toArray(), "rot (deg): [-139, -22, -162]")
  }

  protected onCreate(): void {
    // Disable player movement during title screen
    const playerComponent = this.player.getComponent(PlayerComponent)
    if (playerComponent) {
      playerComponent.setMovementEnabled(false)
    }

    // Debug: Log the values we're about to set
    console.log("TitleScreen: Capturing camera - pos:", this.titleCameraPosition.toArray(), "quat:", this.titleCameraQuaternion.toArray())

    // Capture camera to title screen position instantly (duration = 0)
    this.cameraManager.captureCamera(
      this.titleCameraPosition,
      this.titleCameraQuaternion,
      0 // instant
    )

    // Create UI
    this.createUI()
  }

  /**
   * Create the title screen UI elements
   * Uses percentage-based positioning (like TutorialSystemComponent) for proper mobile responsiveness
   * Combined with --ui-scale transform for consistent sizing with rest of UI
   */
  private createUI(): void {
    // Create overlay container
    this.overlayElement = document.createElement("div")
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      z-index: 9999;
      cursor: pointer;
    `

    // Create title text - Burger Shop with Rush as accented subtitle
    // Uses percentage positioning + --ui-scale for responsive behavior
    this.titleElement = document.createElement("div")
    this.titleElement.innerHTML = `
      <div style="
        font-size: 80px;
        font-weight: bold;
        letter-spacing: 4px;
        color: #FFFFFF;
        text-shadow: 
          -2px -2px 0 #1a1a1a,
          2px -2px 0 #1a1a1a,
          -2px 2px 0 #1a1a1a,
          2px 2px 0 #1a1a1a,
          0 -2px 0 #1a1a1a,
          0 2px 0 #1a1a1a,
          -2px 0 0 #1a1a1a,
          2px 0 0 #1a1a1a,
          6px 3px 0 #1a1a1a,
          8px 4px 20px rgba(0, 0, 0, 0.6);
      ">Burger Shop</div>
      <div style="
        font-size: 100px;
        font-weight: bold;
        font-style: italic;
        color: #FFE135;
        letter-spacing: 6px;
        margin-top: -30px;
        margin-left: 0px;
        text-shadow: 
          -1px -1px 0 #8c0f12,
          1px -1px 0 #8c0f12,
          -1px 1px 0 #8c0f12,
          1px 1px 0 #8c0f12,
          0 -1px 0 #8c0f12,
          0 1px 0 #8c0f12,
          -1px 0 0 #8c0f12, 
          1px 0 0 #8c0f12,
          5px 0 0 #8c0f12,
          10px 0 0 #ff5c00,
          8px 2px 20px rgba(0, 0, 0, 0.6);
      ">RUSH</div>
    `
    this.titleElement.style.cssText = `
      position: absolute;
      top: 5%;
      left: 3%;
      font-family: var(--game-font);
      user-select: none;
      transform: scale(var(--ui-scale, 1));
      transform-origin: top left;
      white-space: nowrap;
    `
    this.overlayElement.appendChild(this.titleElement)

    // Create debug info - hidden by default (set display: block to show)
    this.debugElement = document.createElement("div")
    this.debugElement.style.cssText = `
      display: none;
      position: absolute;
      bottom: 25%;
      left: 50%;
      transform: translateX(-50%) scale(var(--ui-scale, 1));
      transform-origin: center bottom;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      color: #00ff00;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid #00ff00;
      user-select: none;
      text-align: center;
    `
    this.updateDebugText()
    this.overlayElement.appendChild(this.debugElement)

    // Create click prompt - centered between bottom and middle (35% from bottom)
    // Uses percentage positioning + --ui-scale for responsive behavior
    this.promptElement = document.createElement("div")
    this.promptElement.textContent = "Click to continue"
    this.promptElement.style.cssText = `
      position: absolute;
      bottom: 35%;
      left: 50%;
      transform: translate(-50%, 50%) scale(var(--ui-scale, 1));
      transform-origin: center;
      font-family: var(--game-font);
      font-size: 34px;
      font-weight: 600;
      color: white;
      text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.7);
      user-select: none;
      white-space: nowrap;
      animation: titleScreenPulse 1.2s ease-in-out infinite;
    `
    this.overlayElement.appendChild(this.promptElement)

    // Add CSS animation for the pulse effect
    this.addPulseAnimation()

    // Add click handler
    this.overlayElement.addEventListener("click", this.handleClick)

    // Add to UISystem container for proper safe area handling, fallback to body
    const uiContainer = document.getElementById("ui-system-three")
    if (uiContainer) {
      uiContainer.appendChild(this.overlayElement)
    } else {
      document.body.appendChild(this.overlayElement)
    }
  }

  /**
   * Update the debug text with camera position and rotation
   */
  private updateDebugText(): void {
    if (!this.debugElement) return

    const pos = this.titleCameraPosition
    const posStr = `Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`

    // Convert quaternion to euler for display
    const euler = new THREE.Euler().setFromQuaternion(this.titleCameraQuaternion)
    const rotX = THREE.MathUtils.radToDeg(euler.x).toFixed(1)
    const rotY = THREE.MathUtils.radToDeg(euler.y).toFixed(1)
    const rotZ = THREE.MathUtils.radToDeg(euler.z).toFixed(1)
    const rotStr = `Rotation: (${rotX}°, ${rotY}°, ${rotZ}°)`

    this.debugElement.innerHTML = `${posStr}<br>${rotStr}`
  }

  /**
   * Add CSS animation for the slow pulse effect
   * Uses --ui-scale to maintain proper scaling during animation
   */
  private addPulseAnimation(): void {
    // Check if animation already exists
    if (document.getElementById("title-screen-pulse-style")) return

    const style = document.createElement("style")
    style.id = "title-screen-pulse-style"
    // Animation includes --ui-scale to preserve responsive scaling during pulse
    style.textContent = `
      @keyframes titleScreenPulse {
        0%, 100% {
          transform: translate(-50%, 50%) scale(calc(var(--ui-scale, 1) * 1));
        }
        50% {
          transform: translate(-50%, 50%) scale(calc(var(--ui-scale, 1) * 1.15));
        }
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Handle click to continue
   */
  private handleClick = (): void => {
    if (this.isTransitioning) return
    this.isTransitioning = true

    // Hide UI immediately
    this.hideUI()
    
    // Animate out the shop exterior if it was kept visible for title screen
    if (this.initialShopPurchase.hasPendingExteriorAnimation()) {
      this.initialShopPurchase.animateOutExterior()
    }

    // Release camera back to follow mode with smooth transition
    this.cameraManager.releaseCamera(
      TitleScreen.CAMERA_TRANSITION_DURATION,
      () => this.onTransitionComplete()
    )
  }

  /**
   * Hide the UI elements with fade out
   */
  private hideUI(): void {
    if (this.overlayElement) {
      this.overlayElement.style.transition = "opacity 0.5s ease-out"
      this.overlayElement.style.opacity = "0"
      this.overlayElement.style.pointerEvents = "none"
    }
  }

  /**
   * Called when camera transition completes
   */
  private onTransitionComplete(): void {
    // Enable player movement
    const playerComponent = this.player.getComponent(PlayerComponent)
    if (playerComponent) {
      playerComponent.setMovementEnabled(true)
    }

    // Call the completion callback (e.g., to show UI elements)
    if (this.onComplete) {
      this.onComplete()
    }

    // Clean up and dispose
    this.dispose()
  }

  /**
   * Clean up UI elements
   */
  private dispose(): void {
    // Remove click handler
    if (this.overlayElement) {
      this.overlayElement.removeEventListener("click", this.handleClick)
      
      // Remove from DOM after fade completes
      setTimeout(() => {
        if (this.overlayElement && this.overlayElement.parentNode) {
          this.overlayElement.parentNode.removeChild(this.overlayElement)
        }
        this.overlayElement = null
        this.titleElement = null
        this.promptElement = null
        this.debugElement = null
      }, 500)
    }

    // Remove the style element
    const styleElement = document.getElementById("title-screen-pulse-style")
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement)
    }

    // Dispose the game object
    this.gameObject.dispose()
  }

  protected onCleanup(): void {
    // Ensure UI is cleaned up
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement)
    }
  }
}
