import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { StowKitSystem, ParticleSystemPrefabComponent, PrefabLoader, PlayAudioOneShot2D, Main2DAudioBank } from "@series-inc/rundot-3d-engine/systems"
import { PurchaseArea, UnlockManager, IUnlockable, CostManager } from "@game/money"
import { Cashier } from "./Cashier"
import { ICanHaveCashier } from "./ICanHaveCashier"
import { StationLevelComponent, StationLevelComponentConfig } from "@game/station-levels"
import { CASHIER_CHECKOUT_SPEEDS } from "../BurgerShopBalanceConfig"

/**
 * CashierStation manages the purchase and spawning of a cashier
 * The cashier will be positioned based on the parent component's configuration
 * Also handles speed upgrades for the cashier
 */
export class CashierStation extends Component implements IUnlockable {
    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject!: GameObject

    // Cost and upgrade keys
    private costKey: string
    private speedUpgradeCostKeys: string[]
    
    // Cashier instance
    private cashier: Cashier | null = null
    private cashierObject: GameObject | null = null
    
    // Parent component that can have a cashier
    private parent: ICanHaveCashier

    // Speed upgrade system
    private levelComponent: StationLevelComponent | null = null
    private levelObject: GameObject | null = null
    private currentSpeedLevel: number = 0

    /**
     * Create a cashier station
     * @param parent The component that can have a cashier (checkout, drive-thru, etc)
     * @param costKey Cost key for looking up price in CostManager
     * @param speedUpgradeCostKeys Optional array of cost keys for speed upgrades (defaults based on costKey)
     */
    constructor(
        parent: ICanHaveCashier,
        costKey: string = "cashier",
        speedUpgradeCostKeys?: string[]
    ) {
        super()
        this.parent = parent
        this.costKey = costKey
        // Default upgrade keys based on station type
        this.speedUpgradeCostKeys = speedUpgradeCostKeys || 
            (costKey === "drive_thru_cashier" 
                ? ["drivethru_cashier_speed_1", "drivethru_cashier_speed_2"]
                : ["cashier_speed_1", "cashier_speed_2"])
    }

    protected onCreate(): void {
        // Position this station at the parent's world position
        const parentObj = (this.parent as any).gameObject || (this.parent as any).getGameObject()
        if (parentObj) {
            parentObj.getWorldPosition(this.gameObject.position)
        }
        
        // Setup purchase area
        this.setupPurchaseArea()

        // Setup upgrade system (will be enabled after acquisition)
        this.setupUpgradeSystem()

        // Purchase area starts disabled until unlocked by UnlockManager
        this.purchaseAreaObject.setEnabled(false)
    }

    protected onCleanup(): void {
        // Clean up cashier
        if (this.cashierObject) {
            this.cashierObject.dispose()
            this.cashierObject = null
        }

        if (this.levelObject) {
            this.levelObject.dispose()
            this.levelObject = null
        }
    }

    /**
     * Setup the purchase area
     */
    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("CashierPurchaseArea")
        // Get the world position for the purchase area
        const purchaseAreaWorldPos = this.parent.getPurchaseAreaPosition()
        // Convert to local position relative to this station
        const localPos = this.gameObject.worldToLocal(purchaseAreaWorldPos)
        this.purchaseAreaObject.position.copy(localPos)
        this.gameObject.add(this.purchaseAreaObject)

        // Create purchase area component
        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(2.5, 2), // Match grill upgrade area size
            "Cashier", // label without price
            () => UnlockManager.acquire(this), // completion callback
        )
        this.purchaseAreaObject.addComponent(this.purchaseArea)
    }

    /**
     * Setup the upgrade system for cashier speed
     */
    private setupUpgradeSystem(): void {
        // Create the level object at the same position as the purchase area
        this.levelObject = new GameObject("CashierUpgradeArea")
        const purchaseAreaWorldPos = this.parent.getPurchaseAreaPosition()
        const localPos = this.gameObject.worldToLocal(purchaseAreaWorldPos)
        this.levelObject.position.copy(localPos)
        this.gameObject.add(this.levelObject)

        const config: StationLevelComponentConfig = {
            costKeys: this.speedUpgradeCostKeys,
            label: "Cashier Speed",
            displayName: "Cashier Speed Upgrade",
            size: new THREE.Vector2(2.5, 2), // Match grill upgrade area size
            storageKey: `upgrade_level_${this.gameObject.name}_speed`,
            onChange: (level: number, fromStorage?: boolean) => this.onSpeedLevelChanged(level, fromStorage),
            startUnlocked: false, // Unlocks via UnlockManager after HR station
            playUpgradeSound: false // Uses character_upgrade sound instead
        }

        this.levelComponent = new StationLevelComponent(config)
        this.levelObject.addComponent(this.levelComponent)
        this.levelObject.setEnabled(false)
    }

    /**
     * Called when speed level changes
     */
    private onSpeedLevelChanged(level: number, fromStorage: boolean = false): void {
        this.currentSpeedLevel = level
        // Notify parent that cashier speed changed
        if (this.parent.onCashierSpeedChanged) {
            this.parent.onCashierSpeedChanged(this.getCheckoutSpeed())
        }
        // Spawn upgrade effect above cashier (but not when loading from storage)
        if (!fromStorage && level > 0) {
            this.spawnUpgradeEffectAboveCashier()
        }
    }

    /**
     * Get the current checkout speed (time in seconds per item)
     */
    public getCheckoutSpeed(): number {
        const speedIndex = Math.min(this.currentSpeedLevel, CASHIER_CHECKOUT_SPEEDS.length - 1)
        return CASHIER_CHECKOUT_SPEEDS[speedIndex]
    }

    /**
     * Called when cashier has been acquired (purchased)
     */
    public onAcquire(): void {
        // Create and position the cashier
        this.spawnCashier()

        // Hide the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
        
        // Set the cashier on the parent
        if (this.cashier) {
            this.parent.setCashier(this.cashier)
        }

        // Setup and enable the upgrade system (synchronous - data pre-loaded by StationLevelManager)
        if (this.levelComponent && this.levelObject) {
            this.levelComponent.setup()
            this.levelObject.setEnabled(true)
            this.levelComponent.enable()
        }
    }

    /**
     * Spawn the cashier at the configured position
     */
    private spawnCashier(): void {
        // Create cashier GameObject as child of this station
        this.cashierObject = new GameObject("Cashier")
        this.gameObject.add(this.cashierObject)
        
        // Get the world position and rotation for the cashier
        const cashierWorldPos = this.parent.getCashierPosition()
        const cashierWorldRot = this.parent.getCashierRotation()
        
        // Convert to local position relative to this station
        const localPos = this.gameObject.worldToLocal(cashierWorldPos)
        this.cashierObject.position.copy(localPos)
        
        // Set the cashier rotation (euler angles are already relative)
        this.cashierObject.rotation.copy(cashierWorldRot)

        // Create and add Cashier component
        this.cashier = new Cashier()
        this.cashierObject.addComponent(this.cashier)
    }

    // IUnlockable implementation
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    public getDisplayName(): string {
        return "Cashier"
    }

    public getCost(): number {
        return CostManager.getCost(this.costKey)
    }

    public unlock(): void {
        // Enable purchase area when unlocked
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(): void {
        // Handle local acquisition logic
        this.onAcquire()
    }

    /**
     * Get highlight position for camera showcasing (use purchase area position)
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.getWorldPosition(outPosition)
        } else {
            // Fallback to component position
            this.gameObject.getWorldPosition(outPosition)
        }
    }

    /**
     * Get the cashier instance (for debugging/monitoring)
     */
    public getCashier(): Cashier | null {
        return this.cashier
    }

    /**
     * Get current speed upgrade level
     */
    public getSpeedLevel(): number {
        return this.currentSpeedLevel
    }

    /**
     * Get the level component for registration with UnlockManager
     */
    public getLevelComponent(): StationLevelComponent | null {
        return this.levelComponent
    }

    /**
     * Spawn the upgrade particle effect above the cashier
     */
    private spawnUpgradeEffectAboveCashier(): void {
        if (!this.cashierObject) return

        // Play character upgrade sound
        try {
            PlayAudioOneShot2D(Main2DAudioBank, "character_upgrade")
        } catch (error) {
            console.warn("Failed to play character_upgrade sound:", error)
        }

        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const upgradePrefab = prefabCollection.getPrefabByName("pfx_character_upgrade")

        if (!upgradePrefab) {
            console.warn("pfx_character_upgrade prefab not found")
            return
        }

        // Create a temporary holder positioned 2 meters above the cashier
        const effectHolder = new GameObject("UpgradeEffectHolder")
        const cashierWorldPos = new THREE.Vector3()
        this.cashierObject.getWorldPosition(cashierWorldPos)
        effectHolder.position.copy(cashierWorldPos)
        effectHolder.position.y += 2

        // Instantiate the prefab
        const instance = PrefabLoader.instantiatePrefab(upgradePrefab, effectHolder)
        const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

        if (particleComponent) {
            particleComponent.play()

            // Clean up the effect after 5 seconds (duration of the particle effect)
            setTimeout(() => {
                effectHolder.dispose()
            }, 5000)
        } else {
            effectHolder.dispose()
        }
    }
}
