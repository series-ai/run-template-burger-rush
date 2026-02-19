import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Employee } from "./Employee"
import { EmployeeManager } from "./EmployeeManager"

/**
 * Component that spawns and manages employees in the burger shop
 */
export class EmployeeSpawner extends Component {
  private employees: Employee[] = []
  private employeeObjects: GameObject[] = []
  private employeeManager: EmployeeManager | null = null

  // Configuration
  private readonly SPAWN_POSITIONS = [
    new THREE.Vector3(10, 0, -12), // Near the center of the shop
    new THREE.Vector3(10, 0, -9), 
    new THREE.Vector3(10, 0, -6), 
    new THREE.Vector3(10, 0, -3), 
    new THREE.Vector3(10, 0, 0), 
  ]

  constructor() {
    super()
  }

  protected onCreate(): void {
    // Create and add the EmployeeManager to the same GameObject
    this.employeeManager = new EmployeeManager()
    this.getGameObject().addComponent(this.employeeManager)
  }

  /**
   * Spawn a single employee at the specified index
   */
  private spawnEmployee(index: number): void {
    // Create employee GameObject
    const employeeObject = new GameObject(`Employee_${index}`)

    // Position the employee at one of the spawn positions
    const spawnPosition =
      this.SPAWN_POSITIONS[index % this.SPAWN_POSITIONS.length]
    employeeObject.position.copy(spawnPosition)

    // Set random Y rotation for variety
    employeeObject.rotation.y = Math.random() * Math.PI * 2

    // Spawning employee

    // Create and add Employee component with EmployeeManager
    if (!this.employeeManager) {
      console.error("EmployeeManager not initialized!")
      return
    }
    const employee = new Employee(this.employeeManager)
    employeeObject.addComponent(employee)

    // Store references
    this.employees.push(employee)
    this.employeeObjects.push(employeeObject)

    // Employee spawned
  }

  /**
   * Get all spawned employees
   */
  public getEmployees(): Employee[] {
    return [...this.employees]
  }

  /**
   * Get the employee manager instance
   */
  public getEmployeeManager(): EmployeeManager | null {
    return this.employeeManager
  }

  /**
   * Get the count of active employees
   */
  public getEmployeeCount(): number {
    return this.employees.length
  }

  /**
   * Add a new employee (can be called externally to hire more employees)
   */
  public hireEmployee(): Employee | null {
    const newIndex = this.employees.length

    if (newIndex >= this.SPAWN_POSITIONS.length) {
      console.warn(
        "🏭 Cannot hire more employees - no available spawn positions",
      )
      return null
    }

    // Hiring new employee
    this.spawnEmployee(newIndex)

    return this.employees[this.employees.length - 1]
  }

  /**
   * Fire an employee (remove them from the game)
   */
  public fireEmployee(employeeIndex: number): boolean {
    if (employeeIndex < 0 || employeeIndex >= this.employees.length) {
      console.warn(`🏭 Cannot fire employee - invalid index: ${employeeIndex}`)
      return false
    }

    const employeeObject = this.employeeObjects[employeeIndex]
    console.log(`🏭 Firing ${employeeObject.name}`)

    employeeObject.dispose()

    // Remove from our tracking arrays
    this.employees.splice(employeeIndex, 1)
    this.employeeObjects.splice(employeeIndex, 1)

    console.log(
      `🏭 Employee fired. Remaining employees: ${this.employees.length}`,
    )
    return true
  }

  /**
   * Get employee status for external monitoring (e.g., debug panel)
   */
  public getEmployeeStatus(): Array<{
    name: string
    state: string
    task: string
    position: THREE.Vector3
  }> {
    return this.employees.map((employee, index) => {
      const employeeObject = this.employeeObjects[index]
      return {
        name: employeeObject.name,
        state: (employee as any).getCurrentState
          ? (employee as any).getCurrentState()
          : "unknown",
        task: (employee as any).getCurrentTask
          ? (employee as any).getCurrentTask()
          : "unknown",
        position: employeeObject.position.clone(),
      }
    })
  }

  /**
   * Get active employees (for backward compatibility with the simpler version)
   */
  public getActiveEmployees(): Employee[] {
    return this.employees.filter(
      (e) => !!e.getGameObject() && e.getGameObject().parent !== null,
    )
  }

  /**
   * Clean up all employees when the spawner is removed
   */
  protected onCleanup(): void {
    console.log("🏭 EmployeeSpawner cleaning up...")

    // Dispose all employee GameObjects
    for (const employeeObject of this.employeeObjects) {
      if (employeeObject.parent) {
        employeeObject.parent.remove(employeeObject)
      }
      employeeObject.dispose()
    }

    // Clear arrays
    this.employees = []
    this.employeeObjects = []

    // EmployeeManager will be cleaned up automatically since it's on the same GameObject
    this.employeeManager = null

    console.log("🏭 EmployeeSpawner cleaned up")
  }
}
