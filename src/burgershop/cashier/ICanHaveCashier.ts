import * as THREE from "three"
import { Cashier } from "./Cashier"

/**
 * Interface for components that can have a cashier assigned to them
 */
export interface ICanHaveCashier {
    /**
     * Get the world position where the purchase area should be placed
     */
    getPurchaseAreaPosition(): THREE.Vector3
    
    /**
     * Get the world position where the cashier should spawn
     */
    getCashierPosition(): THREE.Vector3
    
    /**
     * Get the world rotation where the cashier should face
     */
    getCashierRotation(): THREE.Euler
    
    /**
     * Set the cashier reference
     */
    setCashier(cashier: Cashier | null): void

    /**
     * Optional callback when cashier speed changes (from upgrades)
     */
    onCashierSpeedChanged?(newSpeed: number): void
}
