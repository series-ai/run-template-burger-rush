import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { StowKitSystem, PrefabLoader } from "@series-inc/rundot-3d-engine/systems"

/**
 * Target Pointer Component
 * Points to a world position with two display modes:
 * - UI arrow at screen edge when target is off-screen
 * - World-space arrow above target when on-screen
 */
export class TargetPointer extends Component {
  private targetPosition: THREE.Vector3 | null = null
  private camera: THREE.Camera | null = null

  private worldArrowEnabled: boolean = true
  
  // UI Elements
  private uiArrow: HTMLElement | null = null
  private worldArrowMesh: GameObject | null = null
  private materialApplied: boolean = false

  // Animation
  private animationTime: number = 0
  private yOffset: number = 1 // Current height offset (can be overridden per target)
  
  // Configuration - Switching threshold (when to show world arrow vs UI arrow)
  private readonly SWITCH_THRESHOLD_PERCENT = 0.15 // 15% from edge - switches to world arrow when target is in middle 70%
  private readonly SWITCH_THRESHOLD_PERCENT_TOP = 0.15 // 20% from top to account for UI
  
  // Configuration - UI arrow position constraint (where UI arrow is displayed)
  private readonly UI_ARROW_CONSTRAINT_PERCENT = 0.25 // 45% from edge - UI arrow stays in middle 10% of screen
  private readonly UI_ARROW_CONSTRAINT_PERCENT_TOP = 0.25 // 50% from top
  private readonly WORLD_ARROW_Y_OFFSET = 2 // Height above target for world arrow
  private readonly ARROW_BOUNCE_AMPLITUDE = 0.8 // How far to bob up/down
  private readonly ARROW_BOUNCE_SPEED = 5.0 // How fast to bob
  private readonly ARROW_SPIN_SPEED = 2.0 // How fast to spin on Y axis (radians per second)
  
  protected onCreate(): void {
    this.createUIArrow()
    this.createWorldArrowMesh()
  }

  public onDisabled(): void {
    this.hideUIArrow()
    this.hideWorldArrow()
  }
  
  /**
   * Set the target world position to point at
   * @param position World position to point at
   * @param yOffset Optional height offset above target (defaults to WORLD_ARROW_Y_OFFSET)
   */
  public setTarget(position: THREE.Vector3, yOffset?: number): void {
    this.targetPosition = position.clone()
    this.yOffset = yOffset ?? this.WORLD_ARROW_Y_OFFSET
  }
  
  /**
   * Set the camera for projection calculations
   */
  public setCamera(camera: THREE.Camera): void {
    this.camera = camera
  }

  /**
   * Hide the world arrow
   */
  public setWorldArrowEnabled(enabled: boolean): void {
    this.worldArrowEnabled = enabled
  }
  
  /**
   * Create the UI arrow that appears at screen edges
   */
  private createUIArrow(): void {
    const container = document.getElementById("ui-world-system-three")
    if (!container) return
    
    // Create arrow container
    const arrowContainer = document.createElement('div')
    arrowContainer.className = 'target-pointer-ui-arrow'
    arrowContainer.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 10000;
      display: none;
      transform: translate(-50%, 0);
    `
    
    // Create CSS arrow
    const arrow = this.createArrowElement()
    arrowContainer.appendChild(arrow)
    
    container.appendChild(arrowContainer)
    this.uiArrow = arrowContainer
  }
  
  /**
   * Create an image-based arrow element using tutorial-arrow.png
   */
  private createArrowElement(): HTMLElement {
    const container = document.createElement('div')
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      transform-origin: center center;
      position: relative;
    `
    
    // Use the tutorial arrow image
    const arrowImg = document.createElement('img')
    arrowImg.src = 'assets/cozy_game_general/tutorial-arrow.png'
    arrowImg.style.cssText = `
      width: 64px;
      height: auto;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
    `
    
    container.appendChild(arrowImg)
    
    return container
  }
  
  /**
   * Create world arrow mesh using prefab with unlit material override
   */
  private createWorldArrowMesh(): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const arrowPrefab = prefabCollection.getPrefabByName("indicator_top_arrow")

    if (!arrowPrefab) {
      console.warn("indicator_top_arrow prefab not found")
      return
    }

    const group = new GameObject("WorldArrowHolder")
    group.visible = false // Initially hidden, shown based on screen position

    // Instantiate the prefab
    PrefabLoader.instantiatePrefab(arrowPrefab, group)

    this.gameObject.add(group)
    this.worldArrowMesh = group
    this.materialApplied = false
  }

  /**
   * Apply unlit material to the arrow mesh (called from update when mesh is ready)
   */
  private tryApplyUnlitMaterial(): void {
    if (this.materialApplied || !this.worldArrowMesh) return

    let foundMesh = false
    this.worldArrowMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        foundMesh = true
        child.castShadow = false
        child.receiveShadow = false

        // Preserve texture from original material
        const oldMat = child.material as THREE.MeshStandardMaterial
        child.material = new THREE.MeshBasicMaterial({
          map: oldMat?.map ?? null,
          color: oldMat?.color ?? 0xffffff,
        })
      }
    })

    if (foundMesh) {
      this.materialApplied = true
    }
  }
  
  /**
   * Update method called each frame
   */
  public update(deltaTime: number): void {
    if (!this.gameObject.visible)
    {
      this.hideUIArrow()
      this.hideWorldArrow()
      return
    }

    if (!this.targetPosition || !this.camera) return
    if (!this.uiArrow || !this.worldArrowMesh) return

    // Try to apply unlit material once mesh is loaded
    this.tryApplyUnlitMaterial()

    // Accumulate time for animation
    this.animationTime += deltaTime

    // Update world arrow position (with bobbing and spinning)
    this.updateWorldArrowPosition()
    
    // UI arrow points to static elevated position (without bobbing)
    const staticElevatedPosition = this.targetPosition.clone()
    staticElevatedPosition.y += this.yOffset
    
    // Project the static elevated position to screen space
    const screenPos = staticElevatedPosition.project(this.camera)
    
    // Convert to pixel coordinates
    const width = window.innerWidth
    const height = window.innerHeight
    const x = (screenPos.x * 0.5 + 0.5) * width
    const y = (screenPos.y * -0.5 + 0.5) * height

    // Use switching threshold to determine when to show world arrow vs UI arrow
    const switchMarginX = width * this.SWITCH_THRESHOLD_PERCENT
    const switchMarginY = height * this.SWITCH_THRESHOLD_PERCENT
    const switchMarginTop = height * this.SWITCH_THRESHOLD_PERCENT_TOP
    
    // Check if target is on-screen (within switch threshold) to show world arrow
    const isOnScreen = 
      x > switchMarginX && 
      x < width - switchMarginX && 
      y > switchMarginTop &&
      y < height - switchMarginY &&
      screenPos.z < 1 // Not behind camera
    
    // UI arrow only shows when target is off-screen, world arrow only when on-screen
    if (isOnScreen) {
      this.hideUIArrow()
      this.showWorldArrow()
    } else {
      this.showUIArrow()
      this.hideWorldArrow()
      this.updateUIArrowPosition(x, y, width, height, screenPos.z)
    }
  }
  
  /**
   * Update UI arrow position and rotation
   */
  private updateUIArrowPosition(targetX: number, targetY: number, width: number, height: number, screenZ: number): void {
    if (!this.uiArrow) return
    
    // Use UI arrow constraint for positioning (separate from switch threshold)
    const edgeOffsetX = width * this.UI_ARROW_CONSTRAINT_PERCENT
    const edgeOffsetY = height * this.UI_ARROW_CONSTRAINT_PERCENT
    const edgeOffsetTop = height * this.UI_ARROW_CONSTRAINT_PERCENT_TOP
    
    // For targets behind camera, flip to opposite side
    let finalX = targetX
    let finalY = targetY
    if (screenZ > 1) {
      finalX = width - targetX
      finalY = height - targetY
    }
    
    // Calculate position on line from center to target at screen edge
    const centerX = width / 2
    const centerY = height / 2
    
    // Direction from center to target
    const dx = finalX - centerX
    const dy = finalY - centerY
    
    // Find intersection with screen edges
    // Calculate scale factors to reach each edge
    const scaleLeft = dx < 0 ? (edgeOffsetX - centerX) / dx : Infinity
    const scaleRight = dx > 0 ? (width - edgeOffsetX - centerX) / dx : Infinity
    const scaleTop = dy < 0 ? (edgeOffsetTop - centerY) / dy : Infinity
    const scaleBottom = dy > 0 ? (height - edgeOffsetY - centerY) / dy : Infinity
    
    // Use the smallest positive scale (first edge we hit)
    const scale = Math.min(
      Math.abs(scaleLeft),
      Math.abs(scaleRight),
      Math.abs(scaleTop),
      Math.abs(scaleBottom)
    )
    
    // Calculate arrow position on the line
    const arrowX = centerX + dx * scale
    const arrowY = centerY + dy * scale
    
    // Position arrow at edge on the line
    this.uiArrow.style.left = `${arrowX}px`
    this.uiArrow.style.top = `${arrowY}px`
    
    // Calculate angle from screen center toward target
    const angle = Math.atan2(dy, dx)
    
    // Rotate arrow to point toward target (adjust for arrow pointing up by default)
    const arrowElement = this.uiArrow.firstChild as HTMLElement
    if (arrowElement) {
      arrowElement.style.transform = `rotate(${angle + Math.PI / 2}rad)`
    }
  }
  
  /**
   * Update world arrow position above target with bobbing and spinning animation
   */
  private updateWorldArrowPosition(): void {
    if (!this.worldArrowMesh || !this.targetPosition) return

    // Calculate bobbing offset using sine wave
    const bobOffset = Math.sin(this.animationTime * this.ARROW_BOUNCE_SPEED) * this.ARROW_BOUNCE_AMPLITUDE

    // Position above the target in world space with bobbing animation
    const worldPos = this.targetPosition.clone()
    worldPos.y += this.yOffset + 2.5 + bobOffset

    this.worldArrowMesh.position.copy(this.worldArrowMesh.parent!.worldToLocal(worldPos))

    // Spin on Y axis
    this.worldArrowMesh.rotation.y = this.animationTime * this.ARROW_SPIN_SPEED
  }
  
  /**
   * Show UI arrow
   */
  private showUIArrow(): void {
    if (this.uiArrow) {
      this.uiArrow.style.display = 'block'
    }
  }
  
  /**
   * Hide UI arrow
   */
  private hideUIArrow(): void {
    if (this.uiArrow) {
      this.uiArrow.style.display = 'none'
    }
  }
  
  /**
   * Show world arrow
   */
  private showWorldArrow(): void {
    if (this.worldArrowMesh) {
      this.worldArrowMesh.visible = this.worldArrowEnabled
    }
  }
  
  /**
   * Hide world arrow
   */
  private hideWorldArrow(): void {
    if (this.worldArrowMesh) {
      this.worldArrowMesh.visible = false
    }
  }
  
  /**
   * Cleanup
   */
  protected onCleanup(): void {
    if (this.uiArrow) {
      this.hideUIArrow()
      this.uiArrow.remove()
      this.uiArrow = null
    }

    if (this.worldArrowMesh) {
      this.hideWorldArrow()
      this.worldArrowMesh.dispose()
      this.worldArrowMesh = null
    }
  }
}


