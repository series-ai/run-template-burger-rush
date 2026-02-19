import * as THREE from "three"
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"
import { BurgerShopDemo } from "../BurgerShopDemo"
import { Item } from "@game"
import { LevelingSystem } from "../leveling"
import { LEVEL_DRIVETHRU_ORDER_MIN, LEVEL_DRIVETHRU_ORDER_MAX } from "../BurgerShopBalanceConfig"

export enum CarState {
  APPROACHING = "approaching",
  IN_LINE = "in_line",
  AT_WINDOW = "at_window",
  LEAVING = "leaving",
}

/**
 * Three.js version of Car component for drive-thru system
 */
export class Car extends Component {
  private carMeshComponent: MeshRenderer | null = null
  private moveSpeed: number = 5.0 // Base movement speed
  private state: CarState = CarState.APPROACHING
  private burgerOrderCount: number = 1 // How many burgers this car wants
  private carModelIndex: number = 1 // Which car model to use (1-4)

  // Movement properties (legacy - not used in spline-based movement)
  private currentTarget: THREE.Vector3 | null = null
  private waypoints: THREE.Vector3[] = []
  private currentWaypointIndex: number = 0
  private arrivalDistance: number = 1.0

  // Car state (kept for external reference but not actively managed)
  // private state: CarState = CarState.APPROACHING;

  // Car properties
  // private burgerOrderCount: number; // Random 1-3 burgers like customers
  // private carModelIndex: number;
  // private orderIndicator: OrderIndicator | null = null; // TODO: Implement order indicators

  constructor() {
    super()
    this.carModelIndex = Math.floor(Math.random() * 3) + 1
    // Use level-based order range for drive-thru
    const level = LevelingSystem.getLevel()
    const levelIndex = Math.min(level - 1, LEVEL_DRIVETHRU_ORDER_MIN.length - 1)
    const min = LEVEL_DRIVETHRU_ORDER_MIN[levelIndex]
    const max = LEVEL_DRIVETHRU_ORDER_MAX[levelIndex]
    this.burgerOrderCount = Math.floor(Math.random() * (max - min + 1)) + min
  }

  protected onCreate(): void {
    this.createCarVisual()
  }

  protected onCleanup(): void {
    // Car disposed
  }

  public update(deltaTime: number): void {

    // Car movement is handled by CarManager via spline system
    // This update method is kept for compatibility but not used for movement
    // Update order indicator position if it exists
    // if (this.orderIndicator) {
    //   const camera = this.getGameObject()
    //     .getScene()
    //     .getObjectByName("Camera") as THREE.Camera
    //   if (camera) {
    //     this.orderIndicator.update(this.getGameObject(), camera)
    //   }
    // }
  }

  private createCarVisual(): void {
    const modelPath = `restaurant_display_Car_${this.carModelIndex}`
    this.carMeshComponent = new MeshRenderer(modelPath)
    this.getGameObject().addComponent(this.carMeshComponent)
  }

  /**
   * Get the current state of the car
   */
  public getState(): CarState {
    return this.state
  }

  /**
   * Set the car's state
   */
  public setState(newState: CarState): void {
    this.state = newState
  }

  /**
   * Get the number of burgers this car wants to order
   */
  public getBurgerOrderCount(): number {
    return this.burgerOrderCount
  }

  /**
   * Get the car model index (1-4)
   */
  public getCarModelIndex(): number {
    return this.carModelIndex
  }

  /**
   * Get the GameObject this car is attached to
   */
  public getCarGameObject(): GameObject {
    return this.getGameObject()
  }

  /**
   * Update the burger count
   */
  public updateOrderCount(count: number): void {
    this.burgerOrderCount = count
  }

  // Legacy methods for compatibility (not used in spline-based movement)

  /**
   * Legacy method - not used in spline system
   */
  public moveTo(position: THREE.Vector3): void {
    this.currentTarget = position.clone()
    this.waypoints = [position]
    this.currentWaypointIndex = 0
  }

  /**
   * Legacy method - not used in spline system
   */
  public setWaypoints(waypoints: THREE.Vector3[]): void {
    this.waypoints = waypoints.map((wp) => wp.clone())
    this.currentWaypointIndex = 0
    if (waypoints.length > 0) {
      this.currentTarget = waypoints[0].clone()
    }
  }

  /**
   * Legacy method - not used in spline system
   */
  public getCurrentTarget(): THREE.Vector3 | null {
    return this.currentTarget
  }

  /**
   * Legacy method - not used in spline system
   */
  public hasReachedTarget(): boolean {
    if (!this.currentTarget || !this.gameObject) return true

    const distance = this.gameObject.position.distanceTo(this.currentTarget)
    return distance <= this.arrivalDistance
  }

  /**
   * Legacy movement update - not used in spline system
   */
  private updateMovement(deltaTime: number): void {
    if (!this.currentTarget || !this.gameObject) return

    const currentPos = this.gameObject.position
    const targetPos = this.currentTarget

    // Calculate direction to target
    const direction = targetPos.clone().sub(currentPos)
    const distance = direction.length()

    if (distance <= this.arrivalDistance) {
      // Reached current target
      this.onTargetReached()
      return
    }

    // Move towards target
    direction.normalize()
    const moveDistance = this.moveSpeed * deltaTime
    const newPosition = currentPos
      .clone()
      .add(direction.multiplyScalar(moveDistance))

    this.gameObject.position.copy(newPosition)

    // Rotate to face movement direction
    if (direction.length() > 0.1) {
      const angle = Math.atan2(direction.x, direction.z)
      this.gameObject.rotation.set(0, angle, 0)
    }
  }

  /**
   * Legacy target reached handler - not used in spline system
   */
  private onTargetReached(): void {
    this.currentWaypointIndex++

    if (this.currentWaypointIndex < this.waypoints.length) {
      // Move to next waypoint
      this.currentTarget = this.waypoints[this.currentWaypointIndex].clone()
    } else {
      // Reached final destination
      this.currentTarget = null
    }
  }

  public giveBurger(burger: Item) {
    this.burgerOrderCount--;
    if (this.burgerOrderCount < 0) {
      this.burgerOrderCount = 0
    }
    return this.burgerOrderCount;
  }
}
