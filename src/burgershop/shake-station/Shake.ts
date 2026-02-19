import * as THREE from "three"
import { Item } from "@game/inventory"
import { InstancedRenderer } from "@series-inc/rundot-3d-engine"

/**
 * Shake item - Uses burger mesh as placeholder until shake assets are available
 */
export class Shake extends Item {
  private meshComponent: InstancedRenderer | null = null

  public static readonly ITEM_TYPE: string = "shake"
  public static readonly MODEL_NAME: string = "restaurant_display_shake_cup"

  public readonly id: string
  public readonly itemType: string = Shake.ITEM_TYPE

  constructor(sharedMaterial?: THREE.MeshToonMaterial) {
    super()
    this.id = `shake_${Math.floor(Math.random() * 10000)}`
  }

  protected onCreate(): void {
    this.setupShakeModel()
  }

  private setupShakeModel(): void {
    // Use instanced rendering - batch must be pre-registered via StowKitInstanceHelper
    this.meshComponent = new InstancedRenderer(Shake.ITEM_TYPE)
    this.gameObject.addComponent(this.meshComponent)
  }

  public getDimensions(): THREE.Vector3 {
    return new THREE.Vector3(0.8, 0.9, 0.8)
  }

  protected onCleanup(): void {
    super.onCleanup()
  }
}

