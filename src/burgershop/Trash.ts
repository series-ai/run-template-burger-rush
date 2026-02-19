import * as THREE from "three"
import { Item } from "@game/inventory"
import { InstancedRenderer } from "@series-inc/rundot-3d-engine"

export class Trash extends Item {
  private meshComponent: InstancedRenderer | null = null

  public static readonly ITEM_TYPE: string = "trash"
  public static readonly MODEL_NAME_1: string = "restaurant_display_Trash_1"
  public static readonly MODEL_NAME_2: string = "restaurant_display_Trash_2"
  private static readonly TRASH_BATCH_KEYS = ["trash_1", "trash_2"]

  public readonly id: string
  public readonly itemType: string = Trash.ITEM_TYPE

  constructor() {
    super()
    this.id = `trash_${Math.floor(Math.random() * 10000)}`
  }

  protected onCreate(): void {
    // Randomly pick one of the two trash batches
    const randomBatchKey = Trash.TRASH_BATCH_KEYS[
      Math.floor(Math.random() * Trash.TRASH_BATCH_KEYS.length)
    ]

    // Use instanced rendering - batches must be pre-registered via StowKitInstanceHelper
    this.meshComponent = new InstancedRenderer(randomBatchKey)
    this.gameObject.addComponent(this.meshComponent)

    this.setRandomYRotation()
  }

  /**
   * Set a random Y rotation for the trash item (matches Babylon.js version)
   */
  private setRandomYRotation(): void {
    const randomRotation = Math.random() * Math.PI * 2 // 0 to 2π radians
    this.gameObject.rotation.y = randomRotation
  }

  /**
   * Get dimensions of the trash item for stacking
   */
  public getDimensions(): THREE.Vector3 {
    // Make trash taller like burgers for better stacking
    return new THREE.Vector3(0.4, 0.5, 0.4)
  }

  protected onCleanup(): void {
    // meshComponent cleanup is handled automatically by the component system
    super.onCleanup()
  }
}
