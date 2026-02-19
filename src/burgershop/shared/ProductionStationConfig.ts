import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Item } from "@game/inventory"
import { PrefabInstance } from "@game/prefabs"

/**
 * Configuration interface for ProductionStation
 * Allows complete customization of production stations without duplicating code
 */
export interface ProductionStationConfig {
    // Display configuration
    stationComponentsObject: GameObject
    mainObject: GameObject
    counterObject: GameObject
    purchaseAreaObject: GameObject
    upgradeObject: GameObject

    stackPositions: THREE.Vector3[] // Item stack positions on counter (number of positions = number of stacks)
    
    // Production configuration (built-in)
    itemFactory: () => Item // Factory function that creates the item (Burger, Shake, etc.)
    productionDurations: number[] // Cooking/production times per level [3.5, 2.8, 2.2, 1.5]
    maxInventory: number[] // Max item capacity per level [8, 10, 12, 14]
    
    // Visual effects (optional)
    visualComponentsFactory?: (parent: GameObject) => Component[] // Optional factory for visual effects like BurgerPatty with smoke
    
    // Upgrade system
    upgradeMeshNames: string[] // Mesh names for each upgrade level
    upgradeCostKeys: string[] // Cost keys for each upgrade
    upgradeLabel: string // Display label for upgrades (e.g., "Grill Upgrade", "Blender Upgrade")
    upgradeStartUnlocked: boolean // Whether upgrades start unlocked
    
    // Purchase system
    costKey: string // Cost key for purchasing this station
    displayName: string // Display name for the station
    purchaseAreaLabel: string // Label shown on purchase area (e.g., "Grill", "Blender")
    purchaseAreaSize: THREE.Vector2 // Size of the purchase area
    
    // Interaction system
    interactionZonePosition: THREE.Vector3 // Position of interaction zone relative to station
    interactionZoneSize: { width: number; depth: number } // Size of interaction zone
    upgradePosition: THREE.Vector3 // Position of upgrade purchase area
    
    // Audio
    pickupSoundName: string // Sound effect when picking up items
    
    // Optional shared material
    sharedMaterial?: THREE.MeshToonMaterial
}

