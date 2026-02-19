import * as THREE from "three"
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"
import {
  ColliderShape,
  RigidBodyComponentThree,
  RigidBodyType,
  DynamicNavSystem,
} from "@series-inc/rundot-3d-engine/systems"

/**
 * Handles drive-thru specific visual elements in Three.js
 * - Pre-unlock state (regular wall only, common environment handled by BurgerShopEnvironment)
 * - Drive-thru state (drivethru pieces, drivethru wall, entrance streets)
 * - Navigation mesh registration/unregistration
 * Note: The common environment model (grass/trees) is now handled by BurgerShopEnvironment
 */
export class DriveThruEnvironment extends Component {
  private preUnlockRenderers: any[] = []
  private drivethruRenderers: any[] = []
  private preUnlockGameObjects: GameObject[] = []
  private drivethruGameObjects: GameObject[] = []
  private currentState: "pre-unlock" | "drivethru" | "none" = "none"

  // Shared material reference
  private sharedMaterial?: THREE.Material

  constructor(sharedMaterial?: THREE.Material) {
    super()
    this.sharedMaterial = sharedMaterial
  }

  protected onCreate(): void {
    // Start with pre-unlock state
    this.showPreUnlockState()
  }

  protected onCleanup(): void {
    this.dispose()
  }

  /**
   * Show the pre-unlock state (grass, trees, regular wall)
   */
  public showPreUnlockState(): void {
    if (this.currentState === "pre-unlock") return

    // Clean up any existing state
    this.removeCurrentState()

    // Create pre-unlock visuals
    this.createPreUnlockState()
    this.registerPreUnlockMeshesWithNavigation()

    this.currentState = "pre-unlock"
    // Pre-unlock state activated
  }

  /**
   * Show the drivethru state (drivethru pieces, drivethru wall, entrance streets)
   */
  public showDrivethruState(): void {
    if (this.currentState === "drivethru") return

    // Clean up any existing state
    this.removeCurrentState()

    // Create drivethru visuals
    this.createDrivethruState()
    this.registerDrivethruMeshesWithNavigation()

    this.currentState = "drivethru"
    // Drivethru state activated
  }

  /**
   * Remove current state and clean up
   */
  public dispose(): void {
    this.removeCurrentState()
    this.currentState = "none"
  }

  /**
   * Remove whatever state is currently active
   */
  private removeCurrentState(): void {
    if (this.currentState === "pre-unlock") {
      this.unregisterPreUnlockMeshesFromNavigation()
      this.removePreUnlockState()
    } else if (this.currentState === "drivethru") {
      this.unregisterDrivethruMeshesFromNavigation()
      this.removeDrivethruState()
    }
  }

  /**
   * Create the pre-unlock visual state
   */
  private createPreUnlockState(): void {
    if (!this.gameObject) return

    // The common environment model now handles the grass and trees
    // No need to create individual grass and tree objects

    // Wall is now handled by the common model - no need for separate wall object

    // Window display removed - no longer needed before drive-thru unlock
  }

  /**
   * Create the drivethru visual state
   */
  private createDrivethruState(): void {
    if (!this.gameObject) return

    // All drivethru pieces are now handled by the combined v2 model
    // No need to create individual drivethru.obj pieces

    // Drivethru wall is now handled by the combined v2 model
    // No need to create separate wall_drivethru.obj
  }

  /**
   * Remove pre-unlock visual state
   */
  private removePreUnlockState(): void {
    this.preUnlockGameObjects.forEach((gameObject) => {
      if (gameObject && gameObject.parent) {
        gameObject.dispose()
      }
    })
    this.preUnlockGameObjects = []
    this.preUnlockRenderers = []
  }

  /**
   * Remove drivethru visual state
   */
  private removeDrivethruState(): void {
    this.drivethruGameObjects.forEach((gameObject) => {
      if (gameObject && gameObject.parent) {
        gameObject.dispose()
      }
    })
    this.drivethruGameObjects = []
    this.drivethruRenderers = []
  }

  /**
   * Register pre-unlock meshes with navigation system as obstacles
   */
  private registerPreUnlockMeshesWithNavigation(): void {
    // TODO: Implement navigation obstacles for Three.js when NavObstacleComponent is available
    // For now, just log that obstacles should be registered
    // Pre-unlock obstacles registered
  }

  /**
   * Register drivethru meshes with navigation system as obstacles
   */
  private registerDrivethruMeshesWithNavigation(): void {
    // TODO: Implement navigation obstacles for Three.js when NavObstacleComponent is available
    // For now, just log that obstacles should be registered
    // Drive-thru obstacles registered
  }

  /**
   * Unregister pre-unlock meshes from navigation system
   */
  private unregisterPreUnlockMeshesFromNavigation(): void {
    // TODO: Implement navigation obstacle cleanup for Three.js
    // Pre-unlock obstacles unregistered
  }

  /**
   * Unregister drivethru meshes from navigation system
   */
  private unregisterDrivethruMeshesFromNavigation(): void {
    // TODO: Implement navigation obstacle cleanup for Three.js
    // Drive-thru obstacles unregistered
  }

  /**
   * Update method (inherited from Component)
   */
  public update(deltaTime: number): void {
    // Environment is mostly static, no regular updates needed
  }

  /**
   * Get current environment state
   */
  public getCurrentState(): "pre-unlock" | "drivethru" | "none" {
    return this.currentState
  }

  /**
   * Set the shared material for all renderers
   */
  public setSharedMaterial(material: THREE.Material): void {
    this.sharedMaterial = material

    // Update existing renderers
    ;[...this.preUnlockRenderers, ...this.drivethruRenderers].forEach(
      (renderer) => {
        renderer.setMaterial(material)
      },
    )
  }
}
