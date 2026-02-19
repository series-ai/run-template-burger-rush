import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Car } from "./Car"
import {
  DRIVETHRU_INITIAL_CAR_COUNT,
  DRIVETHRU_INITIAL_SPAWN_INTERVAL_MIN,
  DRIVETHRU_INITIAL_SPAWN_INTERVAL_MAX,
  DRIVETHRU_INITIAL_SPLINE_POSITION,
  LEVEL_CAR_MAX_IN_LINE,
} from "../BurgerShopBalanceConfig"
import { LevelingSystem } from "../leveling"

// Interface for car manager
interface CarManager {
  spawnCar(normalizedPosition: number): Car | null
  getCarCount(): number
  getConfig(): { maxCars: number }
  getLineCount(): number
}

export interface CarSpawnerConfig {
  maxCars: number
  spawnInterval: { min: number; max: number }
}

export class CarSpawner extends Component {
  // Timing
  private spawnTimer: number = 0
  private nextSpawnTime: number = 0
  private carsSpawned: number = 0

  // Management
  private carCount: number = 0
  private carManager: CarManager | null = null
  private config: CarSpawnerConfig

  constructor(carManager: CarManager, config: CarSpawnerConfig) {
    super()
    this.carManager = carManager
    this.config = config
    this.scheduleNextSpawn()
  }

  protected onCreate(): void {
    // Schedule first spawn
    this.scheduleNextSpawn()
  }

  protected onCleanup(): void {
    // CarManager will handle car cleanup
  }

  public update(deltaTime: number): void {
    if (!this.areRequiredStationsAcquired()) return
    if (!this.carManager || !this.canSpawnMoreCars()) return

    this.spawnTimer += deltaTime

    // Check if it's time to spawn a new car
    if (this.spawnTimer >= this.nextSpawnTime) {
      this.spawnCar()
      this.scheduleNextSpawn()
      this.spawnTimer = 0
    }
  }

  /**
   * Check if we can spawn more cars (uses level-based max)
   */
  private canSpawnMoreCars(): boolean {
    if (!this.carManager) return false
    const level = LevelingSystem.getLevel()
    const maxCars = LEVEL_CAR_MAX_IN_LINE[Math.min(level - 1, LEVEL_CAR_MAX_IN_LINE.length - 1)]
    return this.carManager.getLineCount() < maxCars
  }

  /**
   * Check if required stations are acquired for drive-thru operation
   */
  private areRequiredStationsAcquired(): boolean {
    // For now, always return true - in full implementation would check drive-thru unlock status
    // TODO: Integrate with proper unlock system when drive-thru is added as unlockable
    return true
  }

  /**
   * Schedule the next car spawn
   */
  private scheduleNextSpawn(): void {
    // Use faster intervals for initial cars
    const isInitialCar = this.carsSpawned < DRIVETHRU_INITIAL_CAR_COUNT
    const min = isInitialCar ? DRIVETHRU_INITIAL_SPAWN_INTERVAL_MIN : this.config.spawnInterval.min
    const max = isInitialCar ? DRIVETHRU_INITIAL_SPAWN_INTERVAL_MAX : this.config.spawnInterval.max
    
    this.nextSpawnTime = min + Math.random() * (max - min)
  }

  /**
   * Spawn a car at the drive-thru entry
   */
  private spawnCar(): void {
    if (!this.carManager) return

    this.carCount++

    // Calculate normalized spawn position - use further along for initial cars
    const isInitialCar = this.carsSpawned < DRIVETHRU_INITIAL_CAR_COUNT
    const normalizedPosition = isInitialCar ? DRIVETHRU_INITIAL_SPLINE_POSITION : 0.0

    // Let CarManager handle the actual car creation and positioning
    const car = this.carManager.spawnCar(normalizedPosition)
    
    if (car) {
      this.carsSpawned++
    }
  }

  /**
   * Get current car count
   */
  public getCarCount(): number {
    return this.carCount
  }
}
