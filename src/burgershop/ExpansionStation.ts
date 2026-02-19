import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { IUnlockable } from "@game/money/index"
import { PurchaseArea } from "@game/money/index"
import { UnlockManager } from "@game/money/index"
import { CostManager } from "@game/money/index"

/**
 * Expansion Station - A purchasable area that unlocks environment upgrades
 * When acquired, it triggers environment changes and unlocks new content
 */
export class ExpansionStation extends Component implements IUnlockable {
    private purchaseArea: PurchaseArea | null = null
    private purchaseAreaObject: GameObject | null = null
    private costKey: string

    constructor(costKey: string = "expansion_station") {
        super()
        this.costKey = costKey
    }

    protected onCreate(): void {
        // Setup purchase area
        this.setupPurchaseArea()

        // Start with purchase area disabled until unlocked
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
    }

    /**
     * Setup the purchase area for this expansion station
     */
    private setupPurchaseArea(): void {
        // Create purchase area as independent object
        this.purchaseAreaObject = new GameObject("ExpansionStationPurchaseArea")

        // Position it at the same location as this GameObject
        const worldPos = new THREE.Vector3()
        this.gameObject.getWorldPosition(worldPos)
        this.purchaseAreaObject.position.copy(worldPos)

        // Create the purchase area component
        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5), // 4x4 area
            "Expand",
            () => UnlockManager.acquire(this), // Completion callback
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)

        // Add to scene (since it's not a child)
        this.gameObject.parent?.add(this.purchaseAreaObject)

        // Purchase area starts disabled - will be enabled when unlocked
        this.purchaseAreaObject.setEnabled(false)
    }

    // IUnlockable implementation

    /**
     * Called when this expansion becomes available for purchase
     */
    public unlock(): void {
        // Enable the purchase area so player can buy it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Called when this expansion has been acquired (purchased)
     */
    public acquire(): void {
        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Note: Environment changes are handled by BurgerShopEnvironment listening to acquire events
    }

    /**
     * Get the cost of this expansion station
     */
    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    /**
     * Get display name for logging/debugging
     */
    public getDisplayName(): string {
        return "Expansion"
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
     * Get highlight position for tutorial system
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        this.gameObject.getWorldPosition(outPosition)
    }

    protected onCleanup(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
    }
}

