import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { SplineThree } from "@series-inc/rundot-3d-engine/systems"

/**
 * Callback function type for line position changes
 */
export type LinePositionChangeDelegate = (
  lineIndex: number,
  worldPosition: THREE.Vector3,
  forwardDirection: THREE.Vector3,
) => void

/**
 * Three.js version of LineOfCustomers component
 * Manages a queue of customers at the checkout station
 */
export class LineOfCustomers extends Component {
  private lineObjects: GameObject[] = []
  private delegates: Map<GameObject, LinePositionChangeDelegate> = new Map()

  // Line configuration
  private readonly spacing: number
  private readonly spline: SplineThree

  constructor(options: { spline: SplineThree; spacing?: number }) {
    super()
    
    if (!options.spline) {
      throw new Error("LineOfCustomers requires a spline to be provided")
    }
    
    this.spline = options.spline
    this.spacing = options.spacing || 1.0 // Default 1 unit between customers
  }

  protected onCreate(): void {
    // Customer line created
  }

  /**
   * Add an object to the back of the line
   */
  public addToLine(
    gameObject: GameObject,
    onPositionChange: LinePositionChangeDelegate,
  ): void {
    this.lineObjects.push(gameObject)
    this.delegates.set(gameObject, onPositionChange)

    const lineIndex = this.lineObjects.length - 1
    const worldPosition = this.getWorldPositionForIndex(lineIndex)
    const forwardDirection = this.getDirectionForIndex(lineIndex)

    onPositionChange(lineIndex, worldPosition, forwardDirection)
  }

  /**
   * Remove an object from the line
   */
  public removeFromLine(gameObject: GameObject): boolean {
    const index = this.lineObjects.indexOf(gameObject)
    if (index === -1) {
      return false // Not in line
    }

    // Remove from line
    this.lineObjects.splice(index, 1)
    this.delegates.delete(gameObject)

    // Update positions of all customers behind the removed one
    this.updateLinePositions()

    // Customer left line
    return true
  }

  /**
   * Get the object at the front of the line (index 0)
   */
  public getFrontCustomer(): GameObject | null {
    return this.lineObjects.length > 0 ? this.lineObjects[0] : null
  }

  /**
   * Get the line length
   */
  public getLineLength(): number {
    return this.lineObjects.length
  }

  /**
   * Check if line is empty
   */
  public isEmpty(): boolean {
    return this.lineObjects.length === 0
  }

  /**
   * Check if the front customer is actually positioned at the front of the line
   * @param threshold - Maximum squared distance allowed (default: 0.25 = 0.5 units)
   * @returns true if front customer is at the front position, false otherwise
   */
  public hasCustomerReachedOrderingPosition(threshold: number = 0.05): boolean {
    const frontCustomer = this.getFrontCustomer()
    if (!frontCustomer) {
      return false // No front customer
    }

    // Get the expected front position (index 0)
    const expectedFrontPosition = this.getWorldPositionForIndex(0)
    
    // Get the current world position of the front customer
    const currentPosition = new THREE.Vector3()
    frontCustomer.getWorldPosition(currentPosition)
    
    // Calculate squared distance
    const squaredDistance = currentPosition.distanceToSquared(expectedFrontPosition)
    
    return squaredDistance <= threshold
  }

  /**
   * Get world position for a specific line index using spline
   */
  private getWorldPositionForIndex(index: number): THREE.Vector3 {
    const distance = index * this.spacing
    return this.spline.getPointAtDistance(distance)
  }

  /**
   * Get forward direction for a specific line index using spline
   */
  private getDirectionForIndex(index: number): THREE.Vector3 {
    const distance = index * this.spacing
    const totalLength = this.spline.getTotalLength()
    
    if (totalLength === 0) {
      return new THREE.Vector3(0, 0, 1) // Default forward
    }
    
    const t = distance / totalLength
    return this.spline.getDirectionAt(t)
  }

  /**
   * Update positions of all customers in line
   */
  private updateLinePositions(): void {
    this.lineObjects.forEach((gameObject, index) => {
      const delegate = this.delegates.get(gameObject)
      if (delegate) {
        const worldPosition = this.getWorldPositionForIndex(index)
        const forwardDirection = this.getDirectionForIndex(index)
        delegate(index, worldPosition, forwardDirection)
      }
    })
  }

  protected onCleanup(): void {
    // Clear all line data
    this.lineObjects = []
    this.delegates.clear()
  }
}
