// Three.js Employee System Components
export { Employee } from "./Employee"
export { EmployeeInventory } from "./EmployeeInventory"
export { EmployeeSpawner } from "./EmployeeSpawner"

// HR/Management Components (moved from hr-station)
export { EmployeeManager } from "./EmployeeManager"
export { HRStation } from "./HRStation"
export { HRUpgradeManager } from "./HRUpgradeManager"

// Note: Original Babylon.js components (Employee, EmployeeSpawner, EmployeeInventory) are
// not exported here to avoid Babylon.js import conflicts in Three.js environment
