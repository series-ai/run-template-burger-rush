import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { SecondOrderDynamics } from "@series-inc/rundot-3d-engine/systems"
import { Item } from "./Item"
import { ItemPair } from "./ItemStack"

/**
 * Simple curve-based stack physics
 * 
 * The stack has one "curvature" value that goes from 0 (straight) to maxCurvature (bent).
 * Items are plotted along a quadratic curve: offset = height² * curvature
 * When moving, curvature bends opposite to velocity. When stopped, springs back to 0.
 */
export class ItemStackPhysics extends Component {
  private items: ItemPair[] = []
  private stackContainer: GameObject | null = null
  
  // Position tracking for velocity
  private previousPosition = new THREE.Vector3()
  private isInitialized = false
  
  // The curve state - just two values!
  private curvature = 0                      // Current curve amount (0 = straight)
  private curveDirection = new THREE.Vector2(0, 0)  // XZ direction of bend (normalized)
  
  // Spring for smooth curvature transitions
  private curvatureSpring!: SecondOrderDynamics
  
  // Configuration
  private maxCurvature: number = 0.15        // Maximum bend amount
  private curveResponse: number = 0.08       // How fast curvature responds to velocity
  private frequency: number = 4.0            // Spring frequency for return to straight
  private damping: number = 0.5              // Spring damping (< 1 = bouncy)
  
  // Rotation
  private rotationAmount: number = 0.3       // How much items rotate along the curve
  private maxRotation: number = 0.4          // Max rotation in radians
  
  // Stabilization
  private initTimer = 0
  private stabilizeTime = 0.15
  
  constructor() {
    super()
  }
  
  protected onCreate(): void {
    // Spring for curvature - starts at 0 (straight)
    this.curvatureSpring = new SecondOrderDynamics(
      this.frequency,
      this.damping,
      1.0,
      new THREE.Vector3(0, 0, 0)  // x = curvature, y/z unused
    )
  }
  
  public updateItems(items: ItemPair[]): void {
    this.items = items

    if (items.length > 0) {
      const firstItem = items[0]
      if (firstItem[1]) {
        this.stackContainer = firstItem[1]!.parent as GameObject
      }
      else {
        this.stackContainer = firstItem[0].getGameObject()!.parent as GameObject
      }
    }

    // Reset on item change
    /*this.curvatureSpring.reset(new THREE.Vector3(0, 0, 0))
    this.curvature = 0
    this.initTimer = 0*/
  }
  
  public setStackContainer(container: GameObject): void {
    this.stackContainer = container
    if (!this.isInitialized) {
      container.getWorldPosition(this.previousPosition)
      this.isInitialized = true
    }
  }
  
  public update(deltaTime: number): void {
    if (this.items.length === 0 || !this.stackContainer) return
    
    // Get current world position
    const currentPos = new THREE.Vector3()
    this.stackContainer.getWorldPosition(currentPos)
    
    // Stabilization period
    this.initTimer += deltaTime
    if (this.initTimer < this.stabilizeTime) {
      this.previousPosition.copy(currentPos)
      this.resetItems()
      return
    }
    
    // Calculate velocity (horizontal only)
    const velocity = new THREE.Vector3()
      .subVectors(currentPos, this.previousPosition)
      .divideScalar(Math.max(deltaTime, 0.001))
    velocity.y = 0
    
    this.previousPosition.copy(currentPos)
    
    // Calculate target curvature based on speed
    const speed = velocity.length()
    let targetCurvature = Math.min(speed * this.curveResponse, this.maxCurvature)
    
    // Update curve direction (opposite to velocity) - only when moving
    if (speed > 0.1) {
      const dir = velocity.clone().normalize().negate()
      // Convert to local space
      const invRot = new THREE.Quaternion()
      this.stackContainer.getWorldQuaternion(invRot)
      invRot.invert()
      dir.applyQuaternion(invRot)
      
      // Smooth direction change
      this.curveDirection.x = this.curveDirection.x * 0.8 + dir.x * 0.2
      this.curveDirection.y = this.curveDirection.y * 0.8 + dir.z * 0.2
      
      // Normalize
      const len = Math.sqrt(this.curveDirection.x ** 2 + this.curveDirection.y ** 2)
      if (len > 0.01) {
        this.curveDirection.x /= len
        this.curveDirection.y /= len
      }
    }
    
    // Spring the curvature toward target
    // Allow negative values for overshoot bounce effect when returning to 0
    const springInput = new THREE.Vector3(targetCurvature, 0, 0)
    const springOutput = this.curvatureSpring.update(springInput, deltaTime)
    this.curvature = springOutput.x  // Allow negative for spring overshoot
    
    // Apply curve to items
    this.applyCurveToItems()
  }
  
  /**
   * Position items along a quadratic curve
   * offset = height² * curvature * direction
   */
  private applyCurveToItems(): void {
    let cumulativeHeight = 0
    
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]
      const itemObj = item[1] ? item[1] : item[0].getGameObject()
      if (!itemObj) {
        cumulativeHeight += item[0].getDimensions?.()?.y || 0.5
        continue
      }
      
      // Height of this item's center in the stack
      const itemHeight = item[0].getDimensions?.()?.y || 0.5
      const heightInStack = cumulativeHeight + itemHeight * 0.5
      cumulativeHeight += itemHeight
      
      // Quadratic curve: offset increases with height squared
      // This gives the natural "drooping" effect
      const curveOffset = heightInStack * heightInStack * this.curvature
      
      // Apply offset in curve direction
      const offsetX = this.curveDirection.x * curveOffset
      const offsetZ = this.curveDirection.y * curveOffset
      
      // Set position (preserve Y stacking height)
      itemObj.position.x = offsetX
      itemObj.position.z = offsetZ
      // Y is set by the stack system, don't touch it
      
      // Rotation: tilt items along the curve
      // Each item tilts to "point" along the curve tangent
      // Tangent of y² is 2y, so rotation increases linearly with height
      const tiltAmount = heightInStack * this.curvature * this.rotationAmount * 2
      const clampedTilt = Math.min(Math.max(tiltAmount, -this.maxRotation), this.maxRotation)
      
      // Tilt on X based on Z direction, tilt on Z based on X direction
      // Flip signs so items tilt WITH the curve direction, not against it
      itemObj.rotation.x = this.curveDirection.y * clampedTilt
      itemObj.rotation.y = 0
      itemObj.rotation.z = -this.curveDirection.x * clampedTilt
    }
  }
  
  private resetItems(): void {
    for (const item of this.items) {
      const itemObj = item[1] ? item[1] : item[0].getGameObject()
      if (!itemObj || item[1]) continue
      itemObj.position.x = 0
      itemObj.position.z = 0
      itemObj.rotation.x = 0
      itemObj.rotation.y = 0
      itemObj.rotation.z = 0
    }
  }
  
  public reset(): void {
    this.curvatureSpring.reset(new THREE.Vector3(0, 0, 0))
    this.curvature = 0
    this.curveDirection.set(0, 0)
    this.resetItems()
  }
  
  public setParameters(params: {
    maxCurvature?: number
    curveResponse?: number
    frequency?: number
    damping?: number
    rotationAmount?: number
    maxRotation?: number
  }): void {
    if (params.maxCurvature !== undefined) this.maxCurvature = params.maxCurvature
    if (params.curveResponse !== undefined) this.curveResponse = params.curveResponse
    if (params.frequency !== undefined) this.frequency = params.frequency
    if (params.damping !== undefined) this.damping = params.damping
    if (params.rotationAmount !== undefined) this.rotationAmount = params.rotationAmount
    if (params.maxRotation !== undefined) this.maxRotation = params.maxRotation
    
    // Recreate spring with new params
    const curr = this.curvatureSpring?.getCurrentPosition() || new THREE.Vector3()
    this.curvatureSpring = new SecondOrderDynamics(
      this.frequency,
      this.damping,
      1.0,
      curr
    )
  }

  public getStackTargetPosition(heightOffset: number): THREE.Vector3 {
    return this.getCurvedPosition(this.items.length + heightOffset)
  }


  public getCurvedPosition(height: number): THREE.Vector3 {
    const curveOffset = height * height * this.curvature
    return new THREE.Vector3(
      this.curveDirection.x * curveOffset,
      height,
      this.curveDirection.y * curveOffset
    )
  }
  
  protected onCleanup(): void {
    this.items = []
  }
}
