/**
 * Burger Shop specific collision groups
 * Defines which entities can collide with each other in the burger shop simulation
 */

// Collision group constants for burger shop entities
export const BurgerShopCollisionGroups = {
  // Group memberships (what group this collider belongs to)
  PLAYER: 0x0001,      // Group 0: Player
  EMPLOYEES: 0x0002,   // Group 1: Employees 
  SENSORS: 0x0004,     // Group 2: Sensors/Interaction Zones

  // Filters (what groups this collider can interact with)
  SENSORS_ONLY: 0x0004,        // Can only hit sensors (not other characters)
  ALL_EXCEPT_CHARACTERS: 0x0004, // Can hit sensors but not player/employees
  ALL: 0x0007,                 // Can hit everything (player + employees + sensors)
} as const
