import * as THREE from "three"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { StowKitSystem, ParticleSystemPrefabComponent, PrefabLoader, PlayAudioOneShot2D, Main2DAudioBank } from "@series-inc/rundot-3d-engine/systems"
import { AnimationUtils } from "@game/shared"
import { CostManager, IUnlockable, PurchaseArea, UnlockManager, GroundLabel, ArrowDirection, LabelSize } from "@game/money"
import { PlayerComponent } from "@game"
import { UpgradeManager } from "./UpgradeManager"
import { GenericUpgradePanel } from "../ui/GenericUpgradePanel"
import { PrefabInstance, BoxComponentJSON } from "@game/prefabs"
import { PLAYER_SPEEDS, PLAYER_INVENTORY_SIZES, PLAYER_PROFIT_MULTIPLIERS } from "../BurgerShopBalanceConfig"
import { BurgerShopDirectory } from "../BurgerShopDirectory"

/**
 * Upgrade station component that allows players to purchase upgrades
 * Three.js version
 */
export class UpgradeStation extends Component implements IUnlockable {
    private stationComponentsObject!: GameObject // Container for all station components
    private interactionZone!: InteractionZone
    private readonly zonePrefabInstance: PrefabInstance
    private readonly labelPrefabInstance: PrefabInstance | null
    private playersInZone: Set<GameObject> = new Set()

    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject: GameObject | null = null
    private costKey: string
    private labelDirection: ArrowDirection
    private readonly prefabInstance: PrefabInstance

    // UI System
    private upgradeUI: any = null // UI element from UISystem
    private isUIVisible: boolean = false
    private isAcquired: boolean = false

    private upgradeManager!: UpgradeManager

    constructor(prefab: PrefabInstance, costKey: string, labelDirection: ArrowDirection = "up") {
        super()
        this.prefabInstance = prefab
        this.costKey = costKey
        this.labelDirection = labelDirection

        // interaction_zone is a sibling of upgrade_station_display, not a child
        this.zonePrefabInstance = prefab.getDescendantByPathOrThrow(
            "/interaction_zone",
        )

        // label is optional - used for ground label
        this.labelPrefabInstance = prefab.getDescendantByPath("/label") ?? null
    }

    protected onCreate(): void {
        const displayPrefabInstance = this.prefabInstance.getDescendantByPath(
            "/upgrade_station_display",
        )
        if (!displayPrefabInstance) {
            throw new Error("Failed to find upgrade station display object")
        }

        this.stationComponentsObject = displayPrefabInstance.gameObject
        this.gameObject.add(this.stationComponentsObject)

        // Setup interaction zone (hidden until acquired)
        this.setupInteractionZone()
        // Setup purchase area (created internally like Table)
        this.setupPurchaseArea()
        // Setup ground label if prefab has label node
        this.setupGroundLabel()

        // Initially hidden until unlocked & acquired
        this.stationComponentsObject.setEnabled(false)
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
    }

    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("UpgradeStationPurchaseArea")
        this.purchaseAreaObject.position
            .copy((this.gameObject as GameObject).position)
            .add(new THREE.Vector3(0, 0, -0.5))

        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5),
            "Upgrades",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
    }

    private setupGroundLabel(): void {
        if (!this.labelPrefabInstance) return

        const groundLabel = new GroundLabel("UPGRADE", this.labelDirection, new THREE.Vector2(3.5, 2), "large")
        this.labelPrefabInstance.gameObject.addComponent(groundLabel)

        // Hide label initially - will be shown when acquired
        this.labelPrefabInstance.gameObject.visible = false
    }

    protected onCleanup(): void {
        // Clean up purchase area
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Clean up UI
        if (this.upgradeUI) {
            this.upgradeUI.close()
            this.upgradeUI = null
        }

        this.playersInZone.clear()
    }

    // IUnlockable implementation
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    public getDisplayName(): string {
        return "Upgrade Station"
    }

    public getCost(): number {
        return CostManager.getCost("upgrade_station")
    }

    public unlock(): void {
        // Upgrade Station unlocked
        // Enable the purchase area so the player can buy it
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    /**
     * Called when upgrade station has been acquired (purchased)
     * @param fromStorage If true, this is being loaded from storage (skip animations)
     */
    public acquire(fromStorage: boolean = false): void {
        // Upgrade Station acquired
        // Note: UnlockManager.acquire() is called by the PurchaseArea, not here
        this.isAcquired = true

        // Enable the station components
        this.stationComponentsObject.setEnabled(true)

        // Show the ground label now that it's acquired
        if (this.labelPrefabInstance) {
            this.labelPrefabInstance.gameObject.visible = true
        }

        // Animate the upgrade station bouncing in (but not when loading from storage)
        if (!fromStorage) {
            AnimationUtils.animateIn(this.stationComponentsObject)
        }

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
        
        // If player is already in the interaction zone, show UI immediately
        if (this.playersInZone.size > 0) {
            this.showUI()
        }
    }

    /**
     * Setup the interaction zone for player interaction
     */
    private setupInteractionZone(): void {
        const boxData = this.zonePrefabInstance.prefabNode.getComponentData<BoxComponentJSON>("box")
        if (!boxData) {
            throw new Error("Upgrade Station interaction_zone prefab must have a box component")
        }

        this.interactionZone = new InteractionZone(
            (other: GameObject) => this.onPlayerEnter(other),
            (other: GameObject) => this.onPlayerExit(other),
            {
                width: boxData.size[0],
                depth: boxData.size[2],
                show: false,
            },
        )

        this.zonePrefabInstance.gameObject.addComponent(this.interactionZone)
    }

    /**
     * Show the upgrade UI
     */
    private showUI(): void {
        if (this.isUIVisible) return

        const panel = GenericUpgradePanel.open({
            title: "Upgrades",
            upgrades: [
                {
                    id: "inventory",
                    label: "Carry",
                    getCurrentLevel: () =>
                        this.upgradeManager.getInventoryLevel(),
                    canUpgrade: () => this.upgradeManager.canUpgradeInventory(),
                    getCost: () => this.upgradeManager.getInventoryCost(),
                    getLevel: () => {
                        const level = this.upgradeManager.getInventoryLevel()
                        return `Level ${level + 1}`
                    },
                    getDescription: () => {
                        const currentSize =
                            this.upgradeManager.getInventorySize()
                        return `Carry ${currentSize} items`
                    },
                    getBenefit: () => {
                        const level = this.upgradeManager.getInventoryLevel()
                        if (level >= PLAYER_INVENTORY_SIZES.length - 1) return ""
                        const nextSize = PLAYER_INVENTORY_SIZES[level + 1]
                        const currentSize = PLAYER_INVENTORY_SIZES[level]
                        return `+${nextSize - currentSize} capacity`
                    },
                    onUpgrade: () => {
                        this.upgradeManager.upgradeInventory()
                        this.spawnUpgradeEffect()
                    },
                },
                {
                    id: "speed",
                    label: "Speed",
                    getCurrentLevel: () => this.upgradeManager.getSpeedLevel(),
                    canUpgrade: () => this.upgradeManager.canUpgradeSpeed(),
                    getCost: () => this.upgradeManager.getSpeedCost(),
                    getLevel: () => {
                        const level = this.upgradeManager.getSpeedLevel()
                        return `Level ${level + 1}`
                    },
                    getDescription: () => {
                        const currentSpeed = this.upgradeManager.getSpeed()
                        const speedPercent = (currentSpeed / PLAYER_SPEEDS[0]) * 100
                        return `${speedPercent.toFixed(0)}% move speed`
                    },
                    getBenefit: () => {
                        const level = this.upgradeManager.getSpeedLevel()
                        if (level >= PLAYER_SPEEDS.length - 1) return ""
                        const nextSpeed = PLAYER_SPEEDS[level + 1]
                        const currentSpeed = PLAYER_SPEEDS[level]
                        const increase = ((nextSpeed - currentSpeed) / PLAYER_SPEEDS[0]) * 100
                        return `+${increase.toFixed(0)}% move speed`
                    },
                    onUpgrade: () => {
                        this.upgradeManager.upgradeSpeed()
                        this.spawnUpgradeEffect()
                    },
                },
                {
                    id: "profit",
                    label: "Profit",
                    getCurrentLevel: () => this.upgradeManager.getProfitLevel(),
                    canUpgrade: () => this.upgradeManager.canUpgradeProfit(),
                    getCost: () => this.upgradeManager.getProfitCost(),
                    getLevel: () => {
                        const level = this.upgradeManager.getProfitLevel()
                        return `Level ${level + 1}`
                    },
                    getDescription: () => {
                        const currentMultiplier =
                            this.upgradeManager.getProfitMultiplier()
                        return `${(currentMultiplier * 100).toFixed(0)}% earnings`
                    },
                    getBenefit: () => {
                        const level = this.upgradeManager.getProfitLevel()
                        if (level >= PLAYER_PROFIT_MULTIPLIERS.length - 1) return ""
                        const nextMultiplier = PLAYER_PROFIT_MULTIPLIERS[level + 1]
                        const currentMultiplier = PLAYER_PROFIT_MULTIPLIERS[level]
                        const increase = (nextMultiplier - currentMultiplier) * 100
                        return `+${increase.toFixed(0)}% earnings`
                    },
                    onUpgrade: () => {
                        this.upgradeManager.upgradeProfit()
                        this.spawnUpgradeEffect()
                    },
                },
            ],
        })
        this.upgradeUI = panel

        this.isUIVisible = true
    }

    /**
     * Create HTML for an upgrade row with label and button
     */
    // Removed per reusable UI builder

    // UI click handlers managed by GenericUpgradePanelThree

    /**
     * Hide the upgrade UI
     */
    private hideUI(): void {
        if (!this.isUIVisible) return

        if (this.upgradeUI) {
            this.upgradeUI.close()
            this.upgradeUI = null
        }

        // Clean up window handlers
        delete (window as any).closeUpgradeUI

        this.isUIVisible = false
    }

    // Purchase flow handled by GenericUpgradePanelThree

    // Player speed updates handled by UpgradeManager

    /**
     * Handle player entering the interaction zone
     */
    private onPlayerEnter(playerGameObject: GameObject): void {
        const playerComponent = playerGameObject.getComponent(PlayerComponent)
        if (!playerComponent) return
        
        // Always track players in zone (even before acquisition)
        this.playersInZone.add(playerGameObject)
        
        // Only show UI if acquired
        if (this.isAcquired) {
            this.showUI()
        }
    }

    /**
     * Handle player exiting the interaction zone
     */
    private onPlayerExit(playerGameObject: GameObject): void {
        const playerComponent = playerGameObject.getComponent(PlayerComponent)

        if (playerComponent) {
            this.playersInZone.delete(playerGameObject)

            // Only hide UI if no players are in the zone
            if (this.playersInZone.size === 0) {
                this.hideUI()
            }
        }
    }

    /**
     * Get the number of players currently in the interaction zone
     */
    public getPlayersInZoneCount(): number {
        return this.playersInZone.size
    }

    public getUpgradeManager(): UpgradeManager {
        return this.upgradeManager
    }

    /**
     * Initialize the upgrade manager
     * Must be called after onCreate() to load saved data
     * @deprecated Use setUpgradeManager() instead for faster startup
     */
    public async initialize(): Promise<void> {
        this.upgradeManager = new UpgradeManager()
        await this.upgradeManager.initialize()
    }

    /**
     * Set a pre-initialized upgrade manager (for faster startup)
     */
    public setUpgradeManager(manager: UpgradeManager): void {
        this.upgradeManager = manager
    }

    /**
     * Get highlight position for camera showcasing(use purchase area position)
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
     * Spawn the upgrade particle effect above the player
     */
    private spawnUpgradeEffect(): void {
        const player = BurgerShopDirectory.getPlayer()
        if (!player) return

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

        // Create a temporary holder positioned 2 meters above the player
        const effectHolder = new GameObject("UpgradeEffectHolder")
        const playerWorldPos = new THREE.Vector3()
        player.getWorldPosition(playerWorldPos)
        effectHolder.position.copy(playerWorldPos)
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
