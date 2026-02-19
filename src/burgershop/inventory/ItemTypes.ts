/**
 * Centralized item type constants for the burger shop.
 * Define constants here to avoid circular dependencies.
 * 
 * Note: These must match the ITEM_TYPE constants in Burger, Shake, and Trash classes.
 */

/**
 * Item type constants - use these instead of string literals
 */
export const ItemTypes = {
    BURGER: "burger",
    SHAKE: "shake",
    TRASH: "trash",
} as const

/**
 * Type for valid item types
 */
export type ItemType = typeof ItemTypes[keyof typeof ItemTypes]

