import * as THREE from "three"
import { SplineThree } from "@series-inc/rundot-3d-engine/systems"
import { PrefabInstance } from "@game/prefabs"

/**
 * Configuration interface for CheckoutStation
 * Allows complete customization of checkout stations without duplicating code
 */
export interface CheckoutStationConfig {
    // Display configuration
    prefabInstance: PrefabInstance // Checkout counter mesh (e.g., "restaurant_display_Checkout")
    
    // Item configuration
    itemType: string // Item type this checkout processes (e.g., "burger", "shake")
    itemIcon?: string // Optional emoji icon for order indicator (defaults to 🍔)
    
    // Purchase system
    costKey: string // Cost key for purchasing this station
    displayName: string // Display name for the station
    purchaseAreaSize: THREE.Vector2 // Size of the purchase area
    
    // Dropoff zone configuration
    dropoffZonePosition: THREE.Vector3 // Position of item dropoff zone
    dropoffZoneSize: { width: number; depth: number } // Size of dropoff zone
    stackPositions: THREE.Vector3[] // Positions where item stacks appear
    dropoffAudioClip: string // Sound when items are placed
    
    // Checkout zone configuration
    checkoutZonePosition: THREE.Vector3 // Position of cashier checkout zone
    checkoutZoneSize: { width: number; depth: number } // Size of checkout zone
    
    // Money system
    moneyPilePosition: THREE.Vector3 // Position of money pile
    itemPriceCostKey: string // Cost key for item price (e.g., "burger_price", "shake_price")
    
    // Customer line configuration
    customerLinePosition: THREE.Vector3 // Position of customer line
    lineSpline: SplineThree // Spline path for customer line
    lineSpacing: number // Space between customers in line
    
    // Audio configuration
    audioClips: string[] // Audio clips used by this station
}

