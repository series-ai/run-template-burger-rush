import { Component } from "@series-inc/rundot-3d-engine"
import type { ItemDropoffZone } from "./ItemDropoffZone"

/**
 * Component that specifies where an entity is allowed to drop off items.
 * Used by employees to prevent them from dropping items at the wrong checkout
 * when walking past other checkouts on the way to their target.
 * 
 * The ItemDropoffZone checks for this component and only accepts items
 * if the zone matches the target.
 */
export class DeliveryTarget extends Component {
    private targetZone: ItemDropoffZone

    constructor(targetZone: ItemDropoffZone) {
        super()
        this.targetZone = targetZone
    }

    /**
     * Check if a given dropoff zone is this delivery target
     */
    public isTarget(zone: ItemDropoffZone): boolean {
        return this.targetZone === zone
    }

    /**
     * Get the target dropoff zone
     */
    public getTargetZone(): ItemDropoffZone {
        return this.targetZone
    }
}
