import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"

/**
 * Camera controller component for simulation games (Three.js version)
 * Handles camera positioning, following targets, and user controls
 * Provides third-person isometric view like the original BurgerSimCamera
 */
export class BurgerSimCamera extends Component {
  // Camera instance
  private camera!: THREE.PerspectiveCamera

  // Target object to follow
  private target: GameObject | null = null

  // Camera settings (converted from Babylon.js angles)
  private controlsEnabled: boolean = false
  private radius: number = 40 // Default distance
  private alpha: number = (230 * Math.PI) / 180 // Horizontal angle (converted from degrees)
  private beta: number = (35 * Math.PI) / 180 // Vertical angle (converted from degrees)
  private fov: number = (35 * Math.PI) / 180 // Field of view

  // Camera position calculation helpers
  private cameraPosition: THREE.Vector3 = new THREE.Vector3()
  private targetPosition: THREE.Vector3 = new THREE.Vector3()

  // Config
  private config: SimCameraConfig = {
    minZoom: 8,
    maxZoom: 100,
    minBeta: Math.PI / 8,
    maxBeta: Math.PI / 2,
    followSmoothness: 8.0, // How fast the camera follows (higher = faster, 0 = instant)
  }

  // Mouse controls
  private mouseX: number = 0
  private mouseY: number = 0
  private isDragging: boolean = false
  private mouseSensitivity: number = 0.005

  /**
   * Called when the component is created and attached to a GameObject
   */
  protected onCreate(): void {
    // Create the camera
    this.camera = new THREE.PerspectiveCamera(
      (this.fov * 180) / Math.PI, // Convert to degrees for Three.js
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )

    // Set up camera limits and controls
    this.setupCameraLimits()
    this.updateCameraPosition()

    // Add camera to scene and set as active
    this.scene.add(this.camera)

    // Controls disabled by default
    this.setControlsEnabled(false)

    // Handle window resize
    window.addEventListener("resize", this.onWindowResize.bind(this))

    console.log("📷 BurgerSimCamera created")
  }

  /**
   * Set up camera angle and zoom limits
   */
  private setupCameraLimits(): void {
    // These will be enforced in updateCameraPosition
    if (this.beta > this.config.maxBeta) this.beta = this.config.maxBeta
    if (this.beta < this.config.minBeta) this.beta = this.config.minBeta
    if (this.radius > this.config.maxZoom) this.radius = this.config.maxZoom
    if (this.radius < this.config.minZoom) this.radius = this.config.minZoom
  }

  /**
   * Update camera position based on spherical coordinates
   */
  private updateCameraPosition(): void {
    // Calculate camera position using spherical coordinates
    // Convert spherical coordinates (alpha, beta, radius) to Cartesian
    const x = this.radius * Math.sin(this.beta) * Math.cos(this.alpha)
    const y = this.radius * Math.cos(this.beta)
    const z = this.radius * Math.sin(this.beta) * Math.sin(this.alpha)

    this.cameraPosition.set(
      this.targetPosition.x + x,
      this.targetPosition.y + y,
      this.targetPosition.z + z,
    )

    this.camera.position.copy(this.cameraPosition)
    this.camera.lookAt(this.targetPosition)
  }

  /**
   * Called every frame after all updates
   * Camera movement happens in lateUpdate to ensure smooth following after player movement
   */
  lateUpdate(deltaTime: number): void {
    if (this.target) {
      // Get the desired target position
      const desiredTarget = new THREE.Vector3(
        this.target.position.x,
        0, // Keep camera target at ground level
        this.target.position.z,
      )

      // If smoothness is 0 or very low, snap directly to target (no smoothing)
      if (this.config.followSmoothness <= 0.01) {
        this.targetPosition.copy(desiredTarget)
      } else {
        // Smoothly lerp camera target towards the desired position
        const smoothingFactor = this.config.followSmoothness * deltaTime
        // Clamp smoothing factor to prevent overshooting at low framerates
        const clampedFactor = Math.min(smoothingFactor, 1.0)

        this.targetPosition.lerp(desiredTarget, clampedFactor)
      }

      // Update camera position based on new target
      this.updateCameraPosition()
    }
  }

  /**
   * Set the target for the camera to follow
   * @param target The GameObject to follow
   * @param snapToTarget If true, immediately snap to target position. If false, smoothly move to it.
   */
  public setTarget(target: GameObject, snapToTarget: boolean = true): void {
    this.target = target

    // Set initial camera target position
    if (target) {
      if (snapToTarget) {
        // Snap immediately to target position
        this.targetPosition.set(target.position.x, 0, target.position.z)
        this.updateCameraPosition()
      }
      // If not snapping, let the lateUpdate smoothly move to the target
    }
  }

  /**
   * Enable or disable camera controls
   */
  public setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled

    if (enabled) {
      // Add mouse event listeners
      document.addEventListener("mousedown", this.onMouseDown.bind(this))
      document.addEventListener("mousemove", this.onMouseMove.bind(this))
      document.addEventListener("mouseup", this.onMouseUp.bind(this))
      document.addEventListener("wheel", this.onWheel.bind(this))
    } else {
      // Remove mouse event listeners
      document.removeEventListener("mousedown", this.onMouseDown.bind(this))
      document.removeEventListener("mousemove", this.onMouseMove.bind(this))
      document.removeEventListener("mouseup", this.onMouseUp.bind(this))
      document.removeEventListener("wheel", this.onWheel.bind(this))

      // Reset to default camera position
      this.resetCamera()
    }
  }

  /**
   * Mouse event handlers for camera controls
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.controlsEnabled) return
    this.isDragging = true
    this.mouseX = event.clientX
    this.mouseY = event.clientY
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.controlsEnabled || !this.isDragging) return

    const deltaX = event.clientX - this.mouseX
    const deltaY = event.clientY - this.mouseY

    // Update camera angles
    this.alpha -= deltaX * this.mouseSensitivity
    this.beta += deltaY * this.mouseSensitivity

    // Apply limits
    this.beta = Math.max(
      this.config.minBeta,
      Math.min(this.config.maxBeta, this.beta),
    )

    this.updateCameraPosition()

    this.mouseX = event.clientX
    this.mouseY = event.clientY
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.controlsEnabled) return
    this.isDragging = false
  }

  private onWheel(event: WheelEvent): void {
    if (!this.controlsEnabled) return

    this.radius += event.deltaY * 0.01
    this.radius = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, this.radius),
    )

    this.updateCameraPosition()
  }

  /**
   * Reset camera to default position
   */
  public resetCamera(): void {
    this.alpha = (230 * Math.PI) / 180
    this.beta = (35 * Math.PI) / 180
    this.radius = 40
    this.updateCameraPosition()
  }

  /**
   * Check if camera controls are enabled
   */
  public areControlsEnabled(): boolean {
    return this.controlsEnabled
  }

  /**
   * Set camera angles
   */
  public setAngles(alpha: number, beta: number): void {
    this.alpha = alpha
    this.beta = beta
    this.updateCameraPosition()
  }

  /**
   * Set camera zoom
   */
  public setZoom(radius: number): void {
    this.radius = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, radius),
    )
    this.updateCameraPosition()
  }

  /**
   * Get the camera instance
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  /**
   * Set camera configuration
   */
  public setConfig(config: Partial<SimCameraConfig>): void {
    this.config = { ...this.config, ...config }
    this.setupCameraLimits()
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }

  /**
   * Cleanup resources when component is removed
   */
  protected onCleanup(): void {
    // Remove event listeners
    if (this.controlsEnabled) {
      this.setControlsEnabled(false)
    }

    window.removeEventListener("resize", this.onWindowResize.bind(this))

    // Remove camera from scene
    this.scene.remove(this.camera)
  }
}

/**
 * Camera configuration interface
 */
export interface SimCameraConfig {
  minZoom: number
  maxZoom: number
  minBeta: number
  maxBeta: number
  followSmoothness: number // How fast the camera follows (higher = faster, 0 = instant)
}
