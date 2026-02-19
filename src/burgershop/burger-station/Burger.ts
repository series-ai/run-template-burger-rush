import * as THREE from "three"
import { Item } from "@game/inventory"
import { InstancedRenderer } from "@series-inc/rundot-3d-engine"

export class Burger extends Item {
  private meshComponent: InstancedRenderer | null = null

  public static readonly ITEM_TYPE: string = "burger"
  public static readonly MODEL_NAME: string = "restaurant_display_Prop_Burger"

  public readonly id: string
  public readonly itemType: string = Burger.ITEM_TYPE

  constructor(sharedMaterial?: THREE.MeshToonMaterial) {
    super()
    this.id = `burger_${Math.floor(Math.random() * 10000)}`
  }

  protected onCreate(): void {
    this.setupBurgerModel()
  }

  private setupBurgerModel(): void {
    // Use instanced rendering - batch must be pre-registered via StowKitInstanceHelper
    this.meshComponent = new InstancedRenderer(Burger.ITEM_TYPE)
    this.gameObject.addComponent(this.meshComponent)
  }

  /**
   * Get dimensions of the burger for stacking
   */
  public getDimensions(): THREE.Vector3 {
    // Return dimensions based on the burger's geometry
    return new THREE.Vector3(0.8, 0.4, 0.8)
  }

  protected onCleanup(): void {
    // meshComponent cleanup is handled automatically by the component system
    super.onCleanup()
  }
}
