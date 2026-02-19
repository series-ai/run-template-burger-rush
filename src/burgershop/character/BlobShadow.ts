import * as THREE from "three"
import { Component, GameObject, InstancedRenderer, InstancedMeshManager } from "@series-inc/rundot-3d-engine"
import { StowKitSystem } from "@series-inc/rundot-3d-engine/systems"

/**
 * Simple blob shadow for characters using GPU instancing.
 * Much faster than real shadows - just a transparent circle.
 */
export class BlobShadow extends Component {
  public static readonly BATCH_KEY: string = "blob_shadow"

  private shadowHolder: GameObject | null = null
  private instancedRenderer: InstancedRenderer | null = null
  private offset: number = 0.15 // Slightly above ground to avoid z-fighting
  private size: number = 1

  // Static flag to track if batch is registered
  private static batchRegistered: boolean = false

  /**
   * Register the blob shadow batch with InstancedMeshManager.
   * Call this once during game setup, after InstancedMeshManager is initialized.
   * Batch auto-grows as needed.
   */
  public static async registerBatch(): Promise<void> {
    if (BlobShadow.batchRegistered) return

    const manager = InstancedMeshManager.getInstance()
    if (!manager.isReady()) {
      console.error("BlobShadow: InstancedMeshManager not initialized")
      return
    }

    // Create geometry - plane facing up
    const geometry = new THREE.PlaneGeometry(1.5, 1.5)
    geometry.rotateX(-Math.PI / 2)

    // Load texture from StowKit
    const texture = await StowKitSystem.getInstance().getTexture("blob_shadow")

    // Create material
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.5,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    // Register batch - no shadows for shadow meshes, auto-grows
    manager.getOrCreateBatch(BlobShadow.BATCH_KEY, geometry, material)
    BlobShadow.batchRegistered = true
  }

  protected onCreate(): void {
    // Create a child GameObject to hold the shadow at the offset position
    this.shadowHolder = new GameObject("BlobShadowHolder")
    this.shadowHolder.position.y = this.offset
    this.gameObject.add(this.shadowHolder)

    // Add instanced renderer to the holder
    this.instancedRenderer = new InstancedRenderer(BlobShadow.BATCH_KEY)
    this.shadowHolder.addComponent(this.instancedRenderer)

    // Apply initial size
    this.shadowHolder.scale.setScalar(this.size)
  }

  /**
   * Set shadow size
   */
  public setSize(size: number): void {
    this.size = size
    if (this.shadowHolder) {
      this.shadowHolder.scale.setScalar(size)
    }
  }

  /**
   * Set shadow opacity (note: affects all shadows since material is shared)
   * For per-instance opacity, would need instance attributes
   */
  public setOpacity(opacity: number): void {
    // With instancing, we can't set per-instance opacity without custom attributes
    // This is a limitation - all shadows share the same material
    console.warn("BlobShadow.setOpacity: Per-instance opacity not supported with instancing")
  }

  protected onCleanup(): void {
    if (this.shadowHolder) {
      this.gameObject.remove(this.shadowHolder)
      this.shadowHolder = null
    }
    this.instancedRenderer = null
  }
}
