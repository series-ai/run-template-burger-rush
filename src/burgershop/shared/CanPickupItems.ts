import { Component } from "@series-inc/rundot-3d-engine"

/**
 * Permission component that grants permission to pick up specific item types.
 * Used by the employee system to prevent employees from picking up wrong items.
 * 
 * Example:
 * - Employee assigned to clean table: CanPickupItems(["trash"])
 * - Employee assigned to deliver burgers: CanPickupItems(["burger"])
 * - Employee assigned to deliver shakes: CanPickupItems(["shake"])
 */
export class CanPickupItems extends Component {
    private allowedItemTypes: Set<string>

    constructor(itemTypes: string[]) {
        super()
        this.allowedItemTypes = new Set(itemTypes)
    }

    /**
     * Check if this entity can pick up a specific item type
     */
    public canPickup(itemType: string): boolean {
        return this.allowedItemTypes.has(itemType)
    }

    /**
     * Get all allowed item types
     */
    public getAllowedItemTypes(): string[] {
        return Array.from(this.allowedItemTypes)
    }
}

