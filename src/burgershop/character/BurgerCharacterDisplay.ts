import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { AnimationPerformance } from "@series-inc/rundot-3d-engine/systems"
import { SkeletalRenderer } from "@series-inc/rundot-3d-engine"
import { BlobShadow } from "./BlobShadow"

/**
 * Display component for burger shop characters
 * Handles skeletal rendering using materials from the model
 * Works with player, employees, and customers
 */
export class BurgerCharacterDisplay extends Component {
  private skeletalRenderer: SkeletalRenderer | null = null
  private characterModel: THREE.Object3D | null = null
  private characterPath: string
  private blobShadow: BlobShadow | null = null

  constructor(characterPath: string = "stowkit://Character_Employee_01") {
    super()
    this.characterPath = characterPath
  }

  protected onCreate(): void {
    this.createDisplay()
  }

  /**
   * Create the character mesh using SkeletalRenderer
   */
  private createDisplay(): void {
    // Create skeletal renderer for preloaded character model
    this.skeletalRenderer = new SkeletalRenderer(
      this.characterPath,
      undefined // No custom material
    )
    
    this.gameObject.addComponent(this.skeletalRenderer)
    
    // Get the properly cloned skeletal model
    this.characterModel = this.skeletalRenderer.getSkeletalModel()
    if (this.characterModel) {
      // Optimize skinning for mobile performance
      const settings = AnimationPerformance.getRecommendedSettings()
      if (AnimationPerformance.isMobile()) {
        AnimationPerformance.optimizeModelForMobile(this.characterModel, settings.maxSkinInfluences)
        console.log(`BurgerCharacterDisplay: Optimized model for mobile with ${settings.maxSkinInfluences} skin influences`)
      }
      
      // PERFORMANCE: Disable ALL shadows on characters (use blob shadows instead)
      this.characterModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // No shadows at all - we'll use blob shadows
          child.castShadow = false
          child.receiveShadow = false
          
          // Enable frustum culling for performance
          child.frustumCulled = true
        }
      })
      
      // Add blob shadow (no target needed - it follows the GameObject)
      this.blobShadow = new BlobShadow()
      this.gameObject.addComponent(this.blobShadow)
    } else {
      console.error("BurgerCharacterDisplay: Failed to get skeletal model")
    }
  }

  // ========== API for Animator Component ==========

  /**
   * Get the skeletal model for animation setup
   * Used by BurgerCharacterAnimator to connect animations
   */
  public getSkeletalModel(): THREE.Object3D | null {
    return this.characterModel
  }

  /**
   * Get the renderer group for positioning
   */
  public getGroup(): THREE.Group | null {
    return this.skeletalRenderer?.getGroup() || null
  }
}
