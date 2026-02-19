import * as THREE from "three"
import {
  OrderIndicator,
  OrderIndicatorConfig,
} from "./OrderIndicator"
import { BurgerShopDirectory } from "@game"

/**
 * Simple factory system for creating order indicators
 * Each checkout/drive-thru manages their own indicator lifecycle
 */
export class OrderIndicatorSystem {
  /**
   * Create a new order indicator instance
   */
  public static createIndicator(
    config: OrderIndicatorConfig,
  ): OrderIndicator {
    return new OrderIndicator(config)
  }

  /**
   * Get the current camera from the directory system
   */
  public static getCamera(): THREE.Camera | null {
    return BurgerShopDirectory.getMainCamera()
  }
}
