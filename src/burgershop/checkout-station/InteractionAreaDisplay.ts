import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { StowKitSystem } from "@series-inc/rundot-3d-engine/systems"

/**
 * Component that displays a ground decal at the interaction area location
 * Automatically handles color changes and pulsing based on active state
 */
export class InteractionAreaDisplay extends Component {
  private plane: THREE.Mesh | null = null
  private material: THREE.MeshBasicMaterial | null = null
  private texture: THREE.Texture | null = null
  
  // Fixed configuration
  private readonly SPRITE_PATH = "assets/sprites/checkout-area.png"
  private readonly SCALE = new THREE.Vector2(2, 2)
  private readonly INACTIVE_COLOR = new THREE.Color(1, 1, 1) // White
  private readonly ACTIVE_COLOR = new THREE.Color(0, 1, 0) // Green
  private readonly OPACITY = 1
  
  // Animation settings
  private readonly PULSE_SCALE = 1.1 // 10% larger
  private readonly PINGPONG_DURATION = 1 // seconds for one full cycle (up and down)
  
  // State
  private isActive: boolean = false
  private animationFrameId: number | null = null
  private currentColor: THREE.Color = new THREE.Color(1, 1, 1)
  private pulseStartTime: number | null = null
  private isLoading: boolean = false

  protected onCreate(): void {
    this.loadTexture()
  }

  public update(_deltaTime: number): void {
    // Check if texture loaded and we can create the plane
    if (!this.plane && !this.isLoading) {
      const texture = StowKitSystem.getInstance().getTextureSync('checkout_area')
      if (texture) {
        this.createGroundPlane(texture)
      }
    }
  }

  private loadTexture(): void {
    // Check if already cached
    const cached = StowKitSystem.getInstance().getTextureSync('checkout_area')
    if (cached) {
      this.createGroundPlane(cached)
      return
    }

    // Start async load
    this.isLoading = true
    StowKitSystem.getInstance().getTexture('checkout_area').then(texture => {
      this.isLoading = false
      if (!this.plane) {
        this.createGroundPlane(texture)
      }
    })
  }

  protected onDestroy(): void {
    this.stopPulsing()

    if (this.plane) {
      this.gameObject.remove(this.plane)
      this.plane.geometry.dispose()
      this.plane = null
    }

    if (this.material) {
      this.material.dispose()
      this.material = null
    }

    if (this.texture) {
      this.texture.dispose()
      this.texture = null
    }
  }

  /**
   * Create the ground plane and add it to the game object
   */
  private createGroundPlane(texture: THREE.Texture): void {
    this.texture = texture

    // Configure texture for pixel-perfect display
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter

    // Create material - using MeshBasicMaterial for unlit appearance
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      color: this.INACTIVE_COLOR,
      opacity: this.OPACITY,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    })

    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(this.SCALE.x, this.SCALE.y)

    // Create the mesh
    this.plane = new THREE.Mesh(geometry, this.material)

    // Rotate to lie flat on the ground
    this.plane.rotation.x = -Math.PI / 2

    // Lift slightly off the ground to avoid z-fighting
    this.plane.position.y = 0.01

    // Add to game object
    this.gameObject.add(this.plane)
  }
  
  /**
   * Set the interaction area as active (green with pulsing)
   */
  public setActive(): void {
    if (this.isActive) return
    
    this.isActive = true
    // Instantly set to green
    this.currentColor.copy(this.ACTIVE_COLOR)
    if (this.material) {
      this.material.color = this.currentColor
    }
    this.startPulsing()
  }
  
  /**
   * Set the interaction area as inactive (white, no pulsing)
   */
  public setInactive(): void {
    if (!this.isActive) return
    
    this.isActive = false
    // Instantly set to white
    this.currentColor.copy(this.INACTIVE_COLOR)
    if (this.material) {
      this.material.color = this.currentColor
    }
    this.stopPulsingWithTransition()
  }
  
  /**
   * Start the continuous pingpong animation
   */
  private startPulsing(): void {
    this.stopPulsing()
    
    this.pulseStartTime = performance.now()
    
    const animate = () => {
      if (!this.isActive || !this.plane) {
        this.animationFrameId = null
        return
      }
      
      const elapsed = (performance.now() - this.pulseStartTime!) / 1000
      const t = (elapsed % this.PINGPONG_DURATION) / this.PINGPONG_DURATION
      
      // Use smooth cosine wave for pingpong: starts at 0, smoothly goes to 1, back to 0
      const smoothT = 0.5 - 0.5 * Math.cos(t * Math.PI * 2)
      const scale = 1 + (this.PULSE_SCALE - 1) * smoothT
      
      // Apply scale directly (geometry is already sized correctly)
      this.plane.scale.set(scale, scale, 1)
      
      this.animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()
  }
  
  /**
   * Stop the pingpong animation
   */
  private stopPulsing(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    
    // Reset to normal scale
    if (this.plane) {
      this.plane.scale.set(1, 1, 1)
    }
  }
  
  /**
   * Stop pulsing with a smooth transition back to normal scale
   */
  private stopPulsingWithTransition(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    
    if (!this.plane) return
    
    // Get current scale
    const currentScale = this.plane.scale.x
    const targetScale = 1.0
    const transitionDuration = 0.1 // seconds
    const startTime = performance.now()
    
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000
      const t = Math.min(elapsed / transitionDuration, 1)
      
      // Use easing for smooth transition
      const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const scale = currentScale + (targetScale - currentScale) * easedT
      
      if (this.plane) {
        this.plane.scale.set(scale, scale, 1)
      }
      
      if (t < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    animate()
  }
  
  
}