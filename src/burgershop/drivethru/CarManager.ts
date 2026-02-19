import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Car } from "./Car"
import { CarSpawner } from "./CarSpawner"
import { SplineThree } from "@series-inc/rundot-3d-engine/systems"
import {
  DRIVETHRU_MAX_CARS,
  DRIVETHRU_CAR_SPEED,
  DRIVETHRU_CAR_SPACING,
  DRIVETHRU_SPAWN_INTERVAL_MIN,
  DRIVETHRU_SPAWN_INTERVAL_MAX,
  DRIVETHRU_WINDOW_POSITION,
} from "../BurgerShopBalanceConfig"

export interface CarManagerConfig {
  spline: SplineThree // The spline path for cars to follow
  maxCars?: number
  spawnInterval?: { min: number; max: number }
  // Drive-thru line configuration
  driveThruWindowPosition?: number // Position along spline (0-1) where the window is
  carSpacing?: number // Distance between cars in line (in world units)
}

/**
 * CarManager handles all car-related logic for the drive-thru
 * - Coordinates car spawning
 * - Manages car movement along the spline
 * - Tracks car lifecycle
 * - Manages drive-thru line with window position and spacing
 */
export class CarManager extends Component {
  // Configuration
  private config: Required<CarManagerConfig>

  // Components
  private carSpawner: CarSpawner | null = null
  private carSpawnerObject: GameObject | null = null
  private spline: SplineThree

  // Car tracking
  private activeCars: Car[] = [] // Array for efficient iteration
  private carDistance: Map<Car, number> = new Map() // Car -> distance along spline (0 to totalLength)

  // Drive-thru line management
  private carsInLine: Car[] = [] // Ordered list of cars in the drive-thru line
  private carTargetDistance: Map<Car, number> = new Map() // Car -> target distance on spline (world units)

  // Movement
  private readonly CAR_SPEED = DRIVETHRU_CAR_SPEED

  constructor(config: CarManagerConfig) {
    super()

    this.spline = config.spline

    this.config = {
      spline: config.spline,
      maxCars: config.maxCars ?? DRIVETHRU_MAX_CARS,
      spawnInterval: config.spawnInterval ?? { min: DRIVETHRU_SPAWN_INTERVAL_MIN, max: DRIVETHRU_SPAWN_INTERVAL_MAX },
      driveThruWindowPosition: config.driveThruWindowPosition ?? DRIVETHRU_WINDOW_POSITION,
      carSpacing: config.carSpacing ?? DRIVETHRU_CAR_SPACING,
    }
  }

  protected onCreate(): void {
    this.createCarSpawner()
  }

  /**
   * Create the car spawner
   */
  private createCarSpawner(): void {
    if (!this.gameObject) return

    this.carSpawnerObject = new GameObject("CarSpawner")
    this.carSpawnerObject.parent = this.gameObject

    this.carSpawner = new CarSpawner(this, {
      maxCars: this.config.maxCars,
      spawnInterval: this.config.spawnInterval,
    })
    this.carSpawnerObject.addComponent(this.carSpawner)
  }

  protected onCleanup(): void {
    // Clean up all cars
    this.activeCars.forEach((car) => {
      if (car.getCarGameObject()) {
        car.getCarGameObject()!.dispose()
      }
    })

    this.activeCars.length = 0
    this.carDistance.clear()
    this.carsInLine.length = 0
    this.carTargetDistance.clear()

    // Clean up spawner
    if (this.carSpawnerObject) {
      this.carSpawnerObject.dispose()
    }
  }

  public update(deltaTime: number): void {
    this.updateCarMovement(deltaTime)
  }

  /**
   * Get the drive-thru spline
   */
  public getDriveThruSpline(): SplineThree {
    return this.spline
  }

  /**
   * Get all active cars
   */
  public getActiveCars(): Car[] {
    return [...this.activeCars] // Return copy
  }

  /**
   * Get cars in line (ordered from front to back)
   */
  public getCarsInLine(): Car[] {
    return [...this.carsInLine] // Return copy
  }

  /**
   * Get the front car in line
   */
  public getFrontCar(): Car | null {
    return this.carsInLine.length > 0 ? this.carsInLine[0] : null
  }

  /**
   * Check if the front car has reached the window position
   * Now uses distance-based comparison
   */
  public isFrontCarAtWindow(): boolean {
    if (this.carsInLine.length === 0) return false

    const frontCar = this.carsInLine[0]
    const currentDistance = this.carDistance.get(frontCar) ?? 0
    const targetDistance = this.carTargetDistance.get(frontCar) ?? 0
    
    const splineLength = this.spline.getTotalLength()
    const windowDistance = this.config.driveThruWindowPosition * splineLength

    // Check if front car has reached the window (with small tolerance in world units)
    const tolerance = 0.5 // 0.5 world units tolerance
    return (
      Math.abs(currentDistance - targetDistance) < tolerance &&
      Math.abs(targetDistance - windowDistance) < tolerance
    )
  }

  /**
   * Spawn a new car at a specific normalized position on the spline (0-1)
   * Returns the created Car component
   */
  public spawnCar(normalizedPosition: number): Car | null {
    const splineLength = this.spline.getTotalLength()

    if (splineLength === 0) return null

    // Convert normalized position (0-1) to actual distance along spline
    const spawnDistance = normalizedPosition * splineLength

    // Create car GameObject at spawn position
    const spawnPoint = this.spline.getPointAtDistance(spawnDistance)
    const spawnDirection = this.spline.getDirectionAtDistance(spawnDistance)

    const carCount = this.activeCars.length + 1
    const carObject = new GameObject(`DriveThruCar_${carCount}`)
    carObject.position.copy(spawnPoint)

    // Set initial rotation based on spline direction
    if (spawnDirection.length() > 0.001) {
      const angle = Math.atan2(spawnDirection.x, spawnDirection.z)
      carObject.rotation.set(0, angle, 0)
    }

    // Add Car component
    const car = new Car()
    carObject.addComponent(car)

    // Add to active cars list and set initial distance
    this.activeCars.push(car)
    this.carDistance.set(car, spawnDistance) // Start at spawn distance, not 0!

    // Add to line management
    this.addCarToLine(car)

    return car
  }

  /**
   * Add a car to the drive-thru line
   */
  private addCarToLine(car: Car): void {
    this.carsInLine.push(car)
    this.updateLineTargetPositions()
  }

  /**
   * Update target positions for all cars in line based on window position and spacing
   * Now uses actual distance along spline instead of t parameter
   */
  private updateLineTargetPositions(): void {
    const splineLength = this.spline.getTotalLength()

    if (splineLength === 0) return

    // Convert window position from percentage to actual distance
    const windowDistance = this.config.driveThruWindowPosition * splineLength

    for (let i = 0; i < this.carsInLine.length; i++) {
      const car = this.carsInLine[i]

      // Calculate target distance based on line position
      // Front car (index 0) goes to window distance
      // Each subsequent car is spaced behind by carSpacing distance
      const targetDistance = Math.max(0, windowDistance - this.config.carSpacing * i)

      this.carTargetDistance.set(car, targetDistance)
    }
  }

  /**
   * Remove the front car from the line and allow it to continue to exit
   */
  public removeFrontCarFromLine(): void {
    if (this.carsInLine.length === 0) return

    const frontCar = this.carsInLine[0]

    // Remove car from line
    this.carsInLine.shift()
    this.carTargetDistance.delete(frontCar)

    // Set target to end of spline so it continues to exit
    const splineLength = this.spline.getTotalLength()
    this.carTargetDistance.set(frontCar, splineLength)

    // Update positions for remaining cars in line
    this.updateLineTargetPositions()
  }

  /**
   * Update all cars moving along the spline with line management
   * Now uses distance-based movement for constant speed regardless of waypoint spacing
   */
  private updateCarMovement(deltaTime: number): void {
    const splineLength = this.spline.getTotalLength()

    if (splineLength === 0) return

    // Iterate over array efficiently, then lookup position in map
    for (let i = this.activeCars.length - 1; i >= 0; i--) {
      const car = this.activeCars[i]
      const currentDistance = this.carDistance.get(car) ?? 0
      const targetDistance = this.carTargetDistance.get(car) ?? splineLength // Default to end if no target

      // Only move if not at target position
      if (currentDistance < targetDistance) {
        // Move by constant distance per second (ensures constant speed!)
        const newDistance = Math.min(
          targetDistance,
          currentDistance + this.CAR_SPEED * deltaTime,
        )

        // Update position and rotation along spline using distance
        const carGameObject = car.getCarGameObject()
        if (carGameObject) {
          const position = this.spline.getPointAtDistance(newDistance)
          const direction = this.spline.getDirectionAtDistance(newDistance)
          
          carGameObject.position.copy(position)
          
          // Set rotation to face along the spline direction
          if (direction.length() > 0.001) {
            const angle = Math.atan2(direction.x, direction.z)
            carGameObject.rotation.set(0, angle, 0)
          }
        }

        // Update distance for this car
        this.carDistance.set(car, newDistance)
      }

      // Check if car has completed the route (reached end of spline)
      if (currentDistance >= splineLength) {
        this.removeCar(car)
      }
    }
  }

  /**
   * Complete a car's journey through the drive-thru
   */
  private removeCar(car: Car): void {
    // Remove from position tracking
    this.carDistance.delete(car)
    this.carTargetDistance.delete(car)

    // Remove from line if present
    const lineIndex = this.carsInLine.indexOf(car)
    if (lineIndex !== -1) {
      this.carsInLine.splice(lineIndex, 1)
      this.updateLineTargetPositions() // Update remaining cars' positions
    }

    // Remove from array - find index and remove
    const index = this.activeCars.indexOf(car)
    if (index !== -1) {
      this.activeCars.splice(index, 1)
    }

    // Dispose immediately - no timeout needed
    const carGameObject = car.getCarGameObject()
    if (carGameObject) {
      carGameObject.dispose()
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<CarManagerConfig> {
    return this.config
  }

  /**
   * Get car count for spawner
   */
  public getCarCount(): number {
    return this.activeCars.length
  }

  /**
   * Get line count
   */
  public getLineCount(): number {
    return this.carsInLine.length
  }
}
