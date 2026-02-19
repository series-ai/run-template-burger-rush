import { Component } from "@series-inc/rundot-3d-engine"
import { Inventory } from "./Inventory"

/**
 * Component that marks an entity as having an inventory.
 * This allows other systems to discover and access the inventory
 * without needing to know about specific entity types (Player, Employee, etc.)
 */
export class HasInventory extends Component {
    private inventory: Inventory

    constructor(inventory: Inventory) {
        super()
        this.inventory = inventory
    }

    /**
     * Get the inventory associated with this entity
     */
    public getInventory(): Inventory {
        return this.inventory
    }

    /**
     * Set or update the inventory reference
     */
    public setInventory(inventory: Inventory): void {
        this.inventory = inventory
    }
}

