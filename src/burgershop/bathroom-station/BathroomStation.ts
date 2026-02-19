import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import {
    RigidBodyComponentThree,
    SplineThree,
    DynamicNavSystem,
} from "@series-inc/rundot-3d-engine/systems"
import { IUnlockable } from "@game/money/index"
import { PurchaseArea } from "@game/money/index"
import { UnlockManager } from "@game/money/index"
import { CostManager } from "@game/money/index"
import { PrefabInstance } from "@game/prefabs"
import { BurgerShopDirectory, Customer, MoneyPile } from "@game"
import { AnimationUtils } from "@game/shared"
import { LineOfCustomers } from "../customer/LineOfCustomers"
import { BathroomStall } from "./BathroomStall"

/**
 * Bathroom Station - provides bathroom facilities for the restaurant
 * Currently a simple display with 3 stall boxes
 */
export class BathroomStation extends Component implements IUnlockable {
    // Hierarchy containers
    private readonly stationComponentsObject: GameObject
    private readonly collisionParent!: GameObject

    // Bathroom stalls (3 stalls)
    private readonly bathroomStalls: BathroomStall[] = []

    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject: GameObject | null = null
    private costKey: string

    // Station Components
    private customerLine!: LineOfCustomers

    // Tips
    private moneyPile!: MoneyPile
    private readonly moneyPileObject!: GameObject

    // Track if station has been acquired
    private isAcquired: boolean = false

    // Purchase area position from prefab (optional - falls back to offset calculation)
    private purchaseAreaPosition: THREE.Vector3 | null = null

    constructor(prefabInstance: PrefabInstance, costKey: string, lineSpline: SplineThree, stallAmount: number, purchaseAreaPosition?: THREE.Vector3) {
        super()
        this.costKey = costKey
        this.purchaseAreaPosition = purchaseAreaPosition ?? null

        const stationDisplay = prefabInstance.getDescendantByPathOrThrow("/station_display")
        this.stationComponentsObject = stationDisplay.gameObject
        this.stationComponentsObject.setEnabled(false)

        this.collisionParent = prefabInstance.getDescendantByPathOrThrow("/collision").gameObject

        this.moneyPileObject = prefabInstance.getDescendantByPathOrThrow("/money_pile").gameObject

        for (let i = 0; i < stallAmount; i++) {
            const parent = stationDisplay.getDescendantByPathOrThrow(`/stall_${i}`)
            const bathroomStall = new BathroomStall(this, parent)

            parent.gameObject.addComponent(bathroomStall)

            this.bathroomStalls.push(bathroomStall)
        }

        this.setupCustomerLine(lineSpline)
    }

    protected onCreate(): void {
        this.setupPurchaseArea()
        this.setupMoneyPile()

        this.stationComponentsObject.setEnabled(false)

        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
    }

    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("BathroomPurchaseArea")
        
        // Use prefab position if provided, otherwise fall back to offset calculation
        if (this.purchaseAreaPosition) {
            this.purchaseAreaObject.position.copy(this.purchaseAreaPosition)
        } else {
            this.purchaseAreaObject.position
                .copy((this.gameObject as GameObject).position)
                .add(new THREE.Vector3(0, 0, -0.5))
        }

        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5),
            "Bathroom",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
    }

    /**
     * Component cleanup
     */
    protected onCleanup(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        if (this.stationComponentsObject) {
            this.stationComponentsObject.dispose()
        }

        // Remove navigation obstacles for all children with RigidBodyComponents
        this.collisionParent.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component (indicates it has a nav obstacle)
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Remove the navigation obstacle for this GameObject
                DynamicNavSystem.removeObstacleByGameObject(child)
            }
        })
    }

    private setupMoneyPile(): void {
        this.moneyPile = new MoneyPile()
        this.moneyPileObject.addComponent(this.moneyPile)
    }

    private setupCustomerLine(lineSpline: SplineThree): void {
        this.customerLine = new LineOfCustomers({
            spline: lineSpline,
            spacing: 3.0,
        })

        this.stationComponentsObject.addComponent(this.customerLine)
    }

    // IUnlockable implementation
    /**
     * Called when this item becomes available for purchase
     */
    public unlock(): void {
        // Enable the purchase area so player can buy it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Called when this item has been acquired (purchased/built)
     * @param fromStorage Whether loading from saved state (skip animation)
     */
    public acquire(fromStorage: boolean = false): void {
        // Mark as acquired
        this.isAcquired = true

        // Enable the entire station components container
        this.stationComponentsObject.setEnabled(true)

        // Animate in when first purchased (not when loading from storage)
        if (!fromStorage) {
            AnimationUtils.animateIn(this.stationComponentsObject)
        }

        // Add navigation obstacles now that station is active
        this.setupNavigationObstacles(this.collisionParent)

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        BurgerShopDirectory.registerBathroomStation(this)
    }

    /**
     * Get the cost of this bathroom station
     */
    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    /**
     * Get display name for logging/debugging
     */
    public getDisplayName(): string {
        return "Bathroom"
    }

    /**
     * Get the unique ID for this unlockable item
     */
    public getUnlockableId(): string {
        return this.getGameObject().name
    }


    /**
     * Get highlight position for tutorial/unlock highlight systems
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        this.gameObject.getWorldPosition(outPosition)
    }

    public getCustomerLine(): LineOfCustomers {
        return this.customerLine
    }

    public getNeedsCleaning(): boolean {
        for (const stall of this.bathroomStalls) {
            if (!stall.isDirty()) {
                return false
            }
        }
        return true
    }

    public getNumberOfOpenStalls(): number {
        let count = 0
        for (const stall of this.bathroomStalls) {
            if (stall.isAvailable()) {
                count++
            }
        }
        return count
    }

    public getNumberOfDirtyStalls(): number {
        let count = 0
        for (const stall of this.bathroomStalls) {
            if (stall.isDirty()) {
                count++
            }
        }
        return count
    }

    public getDirtyStalls(): BathroomStall[] {
        return this.bathroomStalls.filter(stall => stall.isDirty())
    }

    public isAvailable(): boolean {
        const stallsAvailable = this.bathroomStalls.filter(stall => stall.isAvailable()).length
        const customersInLine = this.customerLine.getLineLength()
        return stallsAvailable > 0 || customersInLine < 4
    }

    public addTip(): void {
        const minTip = CostManager.getCost("bathroom_tip_min")
        const maxTip = CostManager.getCost("bathroom_tip_max")
        const tip = minTip + Math.floor(Math.random() * (maxTip - minTip + 1))
        this.moneyPile.addMoney(tip)
    }

    public findAvailableStall(): BathroomStall | null {
        for (const stall of this.bathroomStalls) {
            if (stall.isAvailable()) {
                return stall
            }
        }
        return null
    }

    private getFrontOfLine(): Customer | null {
        if (!this.customerLine.hasCustomerReachedOrderingPosition()) {
            return null
        }
        return this.customerLine.getFrontCustomer()?.getComponent(Customer) ?? null
    }
    
    /**
     * Setup navigation obstacles for all GameObjects with RigidBody components
     */
    private setupNavigationObstacles(instance: GameObject): void {
        // Traverse all children to find GameObjects with RigidBody components
        instance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Get bounds from the RigidBody component
                const bounds = rigidBody.getBounds()
                const boundsSize = bounds.getSize(new THREE.Vector3())

                // Add rotated navigation obstacle (registers with GameObject UUID for proper cleanup)
                DynamicNavSystem.addRotatedBoxObstacle(child, boundsSize)
            }
        })
    }
}

