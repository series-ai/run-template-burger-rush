import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { IUnlockable } from "@game/money/index"
import { PurchaseArea } from "@game/money/index"
import { UnlockManager } from "@game/money/index"
import { CostManager } from "@game/money/index"
import { AnimationUtils } from "@game/shared"
import { PrefabCollection, PrefabLoader } from "./prefabs"
import { StowKitSystem, DynamicNavSystem, RigidBodyComponentThree } from "@series-inc/rundot-3d-engine/systems"

/**
 * Patio Station - A purchasable area that unlocks the outdoor patio
 * Shows outer wall when not acquired, shows patio when acquired
 * Animates the transition between states
 */
export class PatioStation extends Component implements IUnlockable {
    private purchaseArea: PurchaseArea | null = null
    private purchaseAreaObject: GameObject | null = null
    private costKey: string

    // Track if station has been acquired
    private isAcquired: boolean = false

    // Cached position for highlight system (purchase area gets disposed on acquire)
    private highlightPosition: THREE.Vector3 = new THREE.Vector3()
    
    private outerWallObject!: GameObject
    private patioObject!: GameObject

    constructor(costKey: string) {
        super()
        this.costKey = costKey
    }

    protected onCreate(): void {
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const patioPrefab = prefabCollection.getPrefabByName("patio")
        if (!patioPrefab) {
            console.error("shared_environment prefab not found")
            return
        }
        
        const patioInstance = PrefabLoader.instantiatePrefab(patioPrefab)

        // Get the visual elements from the prefab
        this.outerWallObject = patioInstance.getDescendantByPathOrThrow("/restaurant_display_base_outerwall_front").gameObject
        this.patioObject = patioInstance.getDescendantByPathOrThrow("/restaurant_display_upgrade_patio").gameObject

        this.outerWallObject.setEnabled(true)
        this.patioObject.setEnabled(false)
        
        // Setup navigation obstacles for the outer wall (visible before patio is acquired)
        this.setupNavigationObstacles(this.outerWallObject)
        
        const purchaseAreaPrefab = patioInstance.getDescendantByPathOrThrow("/purchase_area")
        const purchaseAreaPosition = purchaseAreaPrefab.gameObject.getWorldPosition(new THREE.Vector3())
        this.setupPurchaseArea(purchaseAreaPosition)
    }

    /**
     * Setup the purchase area for this patio station
     */
    private setupPurchaseArea(purchaseAreaPosition: THREE.Vector3): void {
        // Create purchase area as independent object
        this.purchaseAreaObject = new GameObject("PatioStationPurchaseArea")

        // Position it at the prefab-defined location
        this.purchaseAreaObject.position.copy(purchaseAreaPosition)

        // Cache position for highlight system (purchase area gets disposed on acquire)
        this.highlightPosition.copy(purchaseAreaPosition)

        // Create the purchase area component
        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5),
            "Patio",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)

        // Purchase area starts disabled - will be enabled when unlocked
        this.purchaseAreaObject.setEnabled(false)
    }

    // IUnlockable implementation

    /**
     * Called when this patio becomes available for purchase
     */
    public unlock(): void {
        // Enable the purchase area so player can buy it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Called when this patio has been acquired (purchased)
     * @param fromStorage Whether loading from saved state (skip animation)
     */
    public acquire(fromStorage: boolean = false): void {
        this.isAcquired = true

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Remove wall navigation obstacles
        this.removeNavigationObstacles(this.outerWallObject)

        if (fromStorage) {
            // Instant transition when loading from storage
            this.outerWallObject.setEnabled(false)
            this.patioObject.setEnabled(true)
            
            // Setup navigation obstacles for patio
            this.setupNavigationObstacles(this.patioObject)
        } else {
            // Animate out the outer wall, then animate in the patio
            AnimationUtils.animateOut(this.outerWallObject, () => {
                this.outerWallObject.setEnabled(false)

                // Show and animate in the patio
                this.patioObject.setEnabled(true)
                AnimationUtils.animateIn(this.patioObject)
                
                // Setup navigation obstacles for patio
                this.setupNavigationObstacles(this.patioObject)
            })
        }
    }

    /**
     * Get the cost of this patio station
     */
    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    /**
     * Get display name for logging/debugging
     */
    public getDisplayName(): string {
        return "Patio"
    }

    /**
     * Get the unique ID for this unlockable item
     */
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    /**
     * Set camera for UI updates
     */
    public setCameraForUI(camera: THREE.Camera): void {
        if (this.purchaseArea) {
            this.purchaseArea.setCamera(camera)
        }
    }

    /**
     * Get highlight position for tutorial/unlock highlight systems
     * Returns the purchase area position for camera highlighting
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        outPosition.copy(this.highlightPosition)
    }

    /**
     * Setup navigation obstacles for all GameObjects with RigidBody components
     */
    private setupNavigationObstacles(instance: GameObject): void {
        instance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                const bounds = rigidBody.getBounds()
                const boundsSize = bounds.getSize(new THREE.Vector3())
                DynamicNavSystem.addRotatedBoxObstacle(child, boundsSize)
            }
        })
    }

    /**
     * Remove navigation obstacles for all GameObjects with RigidBody components
     */
    private removeNavigationObstacles(instance: GameObject): void {
        instance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                DynamicNavSystem.removeObstacleByGameObject(child)
            }
        })
    }

    protected onCleanup(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
        
        // Clean up navigation obstacles
        if (this.isAcquired) {
            this.removeNavigationObstacles(this.patioObject)
        } else {
            this.removeNavigationObstacles(this.outerWallObject)
        }
    }
}
