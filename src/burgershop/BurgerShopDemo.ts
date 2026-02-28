import * as THREE from "three"
import { Sky } from "three-stdlib"
import { AssetManager, GameObject, VenusGame, MeshRenderer } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import {
    AudioSystem,
    DynamicNavSystem,
    GetMasterVolume,
    IsAudioMuted,
    Main2DAudioBank,
    MaterialUtils,
    MusicBank,
    MusicSystem,
    PathVisualizationThree as PathVisualization,
    PhysicsSystem,
    PlayAudioOneShot2D,
    PrefabCollection,
    PrefabLoader,
    RenderingDebugger,
    SetAudioMuted,
    SetMasterVolume,
    SetMusicVolume,
    SharedAnimationManager,
    SplineThree,
    SplineTypeThree,
    StartMusicWithAutoplayHandling,
    StartPlaylistWithAutoplayHandling,
    StowKitSystem,
    UISystem,
} from "@series-inc/rundot-3d-engine/systems"
import {
    CostManager,
    MoneyChangeIndicator,
    MoneySystem,
    MoneyUI,
    PurchaseArea,
    UnlockManager,
} from "@game/money"
import { ShopSystem } from "@game/shop"
import { Burger, BurgerPatty } from "@game/burger-station"
import { CashierStation } from "@game/cashier"
import { CustomerSpawner } from "@game/customer/CustomerSpawner"
import { CustomerConfig } from "@game/customer/CustomerConfig"
import { CarManager, Drivethru } from "@game/drivethru"
import {
    SelfCheckoutCustomerSpawner,
    SelfCheckoutStation,
} from "@game/self-checkout"
import { UpgradeStation, UpgradeManager } from "@game/upgrade-station"
import { HRStation, HRUpgradeManager } from "@game/employee"
import { TutorialSystemComponent, TutorialStep, TutorialTracker } from "@game/tutorial"
import { UnlockHighlightSystem } from "@game/unlock-highlight"
import { TimedAdSystem } from "@game/timed-ads"
import { LevelingSystem } from "./leveling"
import {
    BathroomStation,
    BurgerShopDebugPanel,
    BurgerShopDirectory,
    BurgerShopEnvironment,
    InitialShopPurchase,
    ItemTypes,
    MuteButton,
    MuteMusicButton,
    PlayerComponent,
    Table,
    Trash,
    TrashCan,
    TitleScreen,
} from "@game"
import { ProductionStation, CheckoutStation, ProductionStationConfig, CheckoutStationConfig } from "@game/shared"
import { ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"
import { Shake } from "./shake-station"
import { BlobShadow } from "./character"
import { CameraManager } from "@game/camera"
import { ExpansionStation } from "@game/ExpansionStation"
import { PatioStation } from "@game/PatioStation"
import { PrefabInstance, BoxComponentJSON } from "@game/prefabs"
import { Settings } from "@game/settings"
import { StationLevelManager } from "@game/station-levels"
import {
    COST_STARTING_MONEY,
    COST_INITIAL_SHOP,
    COST_BURGER_STATION,
    COST_BURGER_STATION_2,
    COST_GRILL_STATION,
    COST_CHECKOUT_STATION,
    COST_TABLE_1,
    COST_TABLE_2,
    COST_TABLE_3,
    COST_TABLE_4,
    COST_TABLE_5,
    COST_TABLE_6,
    COST_TABLE_7,
    COST_TABLE_8,
    COST_TABLE_9,
    COST_TABLE_10,
    COST_TABLE_11,
    COST_TABLE_12,
    COST_TABLE_13,
    COST_TABLE_14,
    COST_TABLE_15,
    COST_HR_STATION,
    COST_UPGRADE_STATION,
    COST_DRIVE_THRU,
    COST_CASHIER,
    COST_DRIVE_THRU_CASHIER,
    COST_EXPANSION_STATION,
    COST_EXPANSION_STATION_2,
    COST_EXPANSION_STATION_3,
    COST_PATIO_STATION,
    COST_SELF_CHECKOUT_STATION,
    COST_BATHROOM_STATION,
    COST_BURGER_PRICE,
    COST_DRIVE_THRU_BURGER_PRICE,
    COST_TABLE_TIP_MIN,
    COST_TABLE_TIP_MAX,
    COST_SHAKE_PRICE,
    COST_EMPLOYEE_HIRE,
    COST_EMPLOYEE_SPEED_UPGRADES,
    COST_EMPLOYEE_INVENTORY_UPGRADES,
    COST_PLAYER_SPEED_UPGRADES,
    COST_PLAYER_INVENTORY_UPGRADES,
    COST_PLAYER_PROFIT_UPGRADES,
    COST_GRILL_UPGRADES,
    COST_SHAKE_STATION,
    COST_SHAKE_STATION_2,
    COST_SHAKE_CHECKOUT,
    COST_SHAKE_CASHIER,
    COST_SHAKE_UPGRADES,
    GRILL_PRODUCTION_DURATIONS,
    GRILL_MAX_INVENTORY,
    SHAKE_PRODUCTION_DURATIONS,
    SHAKE_MAX_INVENTORY,
    BURGER_ORDER_MIN,
    BURGER_ORDER_MAX,
    SHAKE_ORDER_MIN,
    SHAKE_ORDER_MAX,
    LEVEL_XP_THRESHOLDS,
    COST_CASHIER_SPEED_UPGRADES,
    COST_DRIVETHRU_CASHIER_SPEED_UPGRADES,
    COST_SHAKE_CASHIER_SPEED_UPGRADES,
    COST_BATHROOM_TIP_MIN,
    COST_BATHROOM_TIP_MAX,
    PICKUP_INVENTORY_DURATION,
    PICKUP_SPEED_DURATION,
    COST_BATHROOM_STATION_2,
} from "./BurgerShopBalanceConfig"
import { VIPCustomerSpawner } from "./customer/VIPCustomerSpawner"
import { PickupSpawner, MoneyPickup, SpeedPickup, InventoryPickup } from "./pickups"


/**
 * Complete Three.js Burger Shop Demo
 * Showcases all migrated systems working together:
 * - Asset loading (OBJ/GLB)
 * - Physics (Rapier)
 * - Navigation (DynamicNav)
 * - Lighting (Three.js native)
 * - Materials (PBR workflow)
 */
export class BurgerShopDemo extends VenusGame {
    private player?: GameObject
    private environment?: GameObject
    private debugPanel?: BurgerShopDebugPanel
    private directionalLight?: THREE.DirectionalLight
    private prefabCollection?: PrefabCollection

    /**
     * Configure VenusGame settings for BurgerShop.
     * Post-processing and audio are handled by the engine.
     */
    protected getConfig() {
        return {
            backgroundColor: 0x0077b6, // Sky blue background
            shadowMapEnabled: true,
            shadowMapType: "vsm" as const,
            toneMapping: "aces" as const,
            toneMappingExposure: 1.0,
            audioEnabled: true,
        }
    }

    // Debug timing system
    private setupStartTime: number = 0
    private stepStartTime: number = 0
    private setupStepTimings: { step: string; duration: number }[] = []

    // Camera system
    private cameraObject?: GameObject
    private cameraManager?: CameraManager

    // Station references for unlock dependencies
    private initialShopPurchase!: InitialShopPurchase
    private burgerStation!: ProductionStation
    private burgerStation2!: ProductionStation
    private checkoutStation!: CheckoutStation
    private cashierStation!: CashierStation
    private driveThruCashierStation!: CashierStation
    private upgradeStation!: UpgradeStation
    private hrStation!: HRStation
    private expansionStation!: ExpansionStation
    private expansionStation2!: ExpansionStation
    private patioStation!: PatioStation
    private selfCheckoutStation!: SelfCheckoutStation
    private bathroomStation!: BathroomStation
    private bathroomStation2!: BathroomStation
    private tables: Table[] = []
    private trashCans: TrashCan[] = []
    private driveThru!: Drivethru // Add drive-thru reference

    // Shake station references
    private shakeStation!: ProductionStation
    private shakeStation2!: ProductionStation
    private shakeCheckout!: CheckoutStation
    private shakeCheckoutCashierStation!: CashierStation

    // Drive-thru system
    private carManager?: CarManager
    // Removed unused carManagerObject field

    // Tutorial system
    private tutorialSystem?: TutorialSystemComponent
    private tutorialSystemObject?: GameObject

    // Unlock highlight system
    private unlockHighlightSystem?: UnlockHighlightSystem
    private unlockHighlightObject?: GameObject

    // Upgrade managers (initialized during system init for faster startup)
    private upgradeManager!: UpgradeManager
    private hrUpgradeManager!: HRUpgradeManager

    // Pickup system
    private pickupSpawner?: PickupSpawner

    // Timed ad system for periodic advertisement display
    private timedAdSystem?: TimedAdSystem
    private timedAdSystemObject?: GameObject

    // Shared material system (like the original Babylon.js version)
    private static sharedMaterial: THREE.MeshToonMaterial | null = null

    /**
     * Get the shared material used throughout the game (similar to BurgerShopSim.getSharedMaterial())
     */
    public static getSharedMaterial(): THREE.MeshToonMaterial | undefined {
        return BurgerShopDemo.sharedMaterial || undefined
    }

    /**
     * Setup local notifications asynchronously without blocking startup
     */
    private setupLocalNotificationsAsync(): void {
        // Fire and forget - runs in background
        (async () => {
            try {
                const comeBackAndPlayNotifId = "burger_time_come_back_and_play_notif"
                const variantStorageKey = "notification_variant_ab_test"

                // Define A/B test notification variants
                const notificationVariants = {
                    buns_scared: {
                        title: "Come back to Burger Shop Rush!",
                        body: "Emergency! The buns are scared! They only feel safe when you're stacking them in Burger Shop Rush."
                    },
                    huge_line: {
                        title: "Come back to Burger Shop Rush!",
                        body: "🍔Customer line is HUGE!🍔 Only your perfect Burger can calm the crowd."
                    }
                }

                // Get or create persistent variant assignment for this user
                let selectedVariant = await RundotGameAPI.appStorage.getItem(variantStorageKey) as "buns_scared" | "huge_line" | null
                if (!selectedVariant) {
                    // First time - randomly assign variant (50/50 split)
                    selectedVariant = Math.random() < 0.5 ? "buns_scared" : "huge_line"
                    await RundotGameAPI.appStorage.setItem(variantStorageKey, selectedVariant)
                }

                const notification = notificationVariants[selectedVariant]

                try {
                    await RundotGameAPI.notifications.cancelNotification(comeBackAndPlayNotifId)
                }
                catch (error) {
                    console.warn(`Failed to cancel local notification ${comeBackAndPlayNotifId}`, error)
                }

                RundotGameAPI.log(`Scheduling local notification (variant: ${selectedVariant}) in 24 hours...`)
                await RundotGameAPI.notifications.scheduleAsync(
                    notification.title,
                    notification.body,
                    60 * 60 * 24,
                    comeBackAndPlayNotifId
                )

                // Record analytics event for A/B test tracking
                RundotGameAPI.analytics.recordCustomEvent("NotificationScheduled", {
                    variant: selectedVariant,
                    body: notification.body,
                    title: notification.title
                })
            } catch (error) {
                console.error("Failed to setup local notifications:", error)
            }
        })()
    }

    /**
     * Start timing a setup step
     */
    private startTimingStep(stepName: string): void {
        this.stepStartTime = performance.now()
        RundotGameAPI.log(`🕐 Starting: ${stepName}...`)
    }

    /**
     * End timing a setup step, log the result, and send analytics event
     */
    private endTimingStep(stepName: string): void {
        const duration = performance.now() - this.stepStartTime
        this.setupStepTimings.push({ step: stepName, duration })
        RundotGameAPI.log(`✅ Completed: ${stepName} (${duration.toFixed(2)}ms)`)

        // Send analytics event (fire and forget - don't await)
        RundotGameAPI.analytics.recordCustomEvent("SetupTiming", {
            step: stepName,
            duration_ms: Math.round(duration),
            duration_seconds: parseFloat((duration / 1000).toFixed(3))
        })
    }

    /**
     * Log the complete timing summary and send analytics event
     */
    private logTimingSummary(): void {
        const totalTime = performance.now() - this.setupStartTime
        RundotGameAPI.log(`\n🎯 === SETUP TIMING SUMMARY ===`)
        RundotGameAPI.log(
            `📊 Total Setup Time: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`,
        )
        RundotGameAPI.log(`📝 Individual Step Timings:`)

        this.setupStepTimings.forEach((timing, index) => {
            const percentage = ((timing.duration / totalTime) * 100).toFixed(1)
            RundotGameAPI.log(
                `  ${index + 1}. ${timing.step}: ${timing.duration.toFixed(2)}ms (${percentage}%)`,
            )
        })

        // Find the slowest step
        const slowestStep = this.setupStepTimings.reduce((prev, current) =>
            prev.duration > current.duration ? prev : current,
        )
        RundotGameAPI.log(
            `🐌 Slowest step: ${slowestStep.step} (${slowestStep.duration.toFixed(2)}ms)`,
        )
        RundotGameAPI.log(`🎯 === END TIMING SUMMARY ===\n`)

        // Send overall summary analytics event (fire and forget - don't await)
        RundotGameAPI.analytics.recordCustomEvent("SetupTimingSummary", {
            total_duration_ms: Math.round(totalTime),
            total_duration_seconds: parseFloat((totalTime / 1000).toFixed(3)),
            slowest_step: slowestStep.step,
            slowest_duration_ms: Math.round(slowestStep.duration),
            step_count: this.setupStepTimings.length
        })
    }

    /**
     * DEPRECATED: Shared material no longer used - StowKit models have their own materials
     */
    private async createSharedMaterial(): Promise<void> {
        // No-op: StowKit models come with materials pre-configured
    }

    protected async onStart(): Promise<void> {
        // Start overall timing
        this.setupStartTime = performance.now()
        console.log(`🚀 === BURGER SHOP SETUP STARTED ===`)

        // Initialize StowKit FIRST - load all assets before game starts
        this.startTimingStep("StowKit Asset Loading")
        await this.loadStowKitAssets()
        this.endTimingStep("StowKit Asset Loading")

        // Suppress Three.js PropertyBinding warnings for missing animation targets
        this.startTimingStep("Animation Console Filter Setup")
        const { AnimationConsoleFilter } = await import(
            "@series-inc/rundot-3d-engine/systems"
        )
        AnimationConsoleFilter.enable()
        this.endTimingStep("Animation Console Filter Setup")

        // Create shared material first (before anything else)
        this.startTimingStep("Shared Material Creation")
        await this.createSharedMaterial()
        this.endTimingStep("Shared Material Creation")

        // Initialize all systems
        this.startTimingStep("Systems Initialization")
        await this.initializeSystems()
        this.endTimingStep("Systems Initialization")

        // Preload legacy assets (OBJ/FBX files not in StowKit)
        this.startTimingStep("Legacy Asset Preloading")
        await this.preloadAssets()
        this.endTimingStep("Legacy Asset Preloading")

        // Set up scene environment
        this.startTimingStep("Scene Environment Setup")
        this.setupSceneEnvironment()
        this.endTimingStep("Scene Environment Setup")

        this.startTimingStep("Lighting Setup")
        this.setupLighting()
        this.endTimingStep("Lighting Setup")

        // Create game world (now with preloaded assets and shared material)
        this.startTimingStep("Game World Creation")
        await this.createGameWorld()
        this.endTimingStep("Game World Creation")

        // Set up camera system and post-processing
        this.startTimingStep("Camera System Setup")
        this.setupCameraSystem()
        this.endTimingStep("Camera System Setup")

        // Post-processing is now handled by VenusGame via config

        // Initialize unlock highlight system after camera is ready
        this.startTimingStep("Unlock Highlight System Initialization")
        if (this.unlockHighlightSystem && this.cameraManager && this.player) {
            this.unlockHighlightSystem.initialize(this.cameraManager, this.player)
        }
        this.endTimingStep("Unlock Highlight System Initialization")

        // Set up title screen (before tutorial so it appears first)
        this.startTimingStep("Title Screen Setup")
        this.setupTitleScreen()
        this.endTimingStep("Title Screen Setup")

        // Set camera for tutorial system's target pointer
        this.startTimingStep("Tutorial System Camera Setup")
        if (this.tutorialSystem) {
            this.tutorialSystem.setCamera(this.camera)
        }
        this.endTimingStep("Tutorial System Camera Setup")

        // Set up debug panel
        this.startTimingStep("Debug Panel Setup")
        this.setupDebugPanel()
        this.endTimingStep("Debug Panel Setup")

        // Set up audio system
        this.startTimingStep("Audio System Setup")
        // AudioSystem.mainListener already set during StowKit initialization with temp listener
        // We'll use that listener for all audio
        if (!AudioSystem.mainListener) {
            throw new Error(
                "AudioSystem.mainListener should have been set during StowKit initialization",
            )
        }

        // Set default volume
        SetMasterVolume(0.2)
            ; (window as any).audioBaseMaster = 0.2

        // Expose audio functions globally for debug panel
        Object.assign(window as any, {
            SetAudioMuted,
            SetMasterVolume,
            GetMasterVolume,
            IsAudioMuted,
        })

        // Load audio files
        try {
            // StowKit audio already loaded in initialization phase
            // Music already started during asset loading
            // Just play startup sound
            PlayAudioOneShot2D(Main2DAudioBank, "character enter")

            // Initialize audio system (handles browser autoplay restrictions internally)
            AudioSystem.initialize()

            // 🎵 Audio2D Component Usage:
            // Components can now use the Audio2D component for easy 2D audio playbook:
            //
            // import { Audio2D } from "@series-inc/rundot-3d-engine/systems"
            //
            // // In your component:
            // private audioComponent = new Audio2D(["assets/sfx/sound.wav"])
            // this.gameObject.addComponent(this.audioComponent)
            // this.audioComponent.play("assets/sfx/sound.wav")
            //
            // Working examples with sounds:
            // - MoneyPile.ts: plays "pick up cash.wav" when money is collected
            // - PlayerInventory.ts: plays "pick up.wav" when items are picked up
            // - TrashCan.ts: plays "trash.wav" when trash is disposed
            // - BurgerStation.ts: plays "pick up.wav" when burgers are taken
            // - CheckoutStation.ts: plays "place burgers.wav" when burgers are delivered to counter
            //                      plays "cash register.wav" when customers buy burgers
            // - Drivethru.ts: plays "cash register.wav" when drive-thru cars buy burgers
        } catch (error) {
            console.error("❌ Failed to load audio files:", error)
            console.log("⚠️ Continuing without audio")
        }
        this.endTimingStep("Audio System Setup")


        this.startTimingStep("Local Notification Setup")

        // Run notification setup asynchronously without blocking startup
        this.setupLocalNotificationsAsync()

        this.endTimingStep("Local Notification Setup")

        // Demo ready
        // Controls configured
        // Rendering configured
        // Physics configured

        // Make renderer and scene globally accessible for debugging
        this.startTimingStep("Global Debug Functions Setup")
            ; (window as any).renderer = this.renderer
            ; (window as any).scene = this.scene
            ; (window as any).game = this
            ; (window as any).camera = this.camera

        // Make debug functions globally available
        RenderingDebugger.makeGloballyAvailable()

            // Make frustum culling debug functions available
            ; (window as any).debugFrustumCulling = (disabled?: boolean) => {
                AssetManager.debugFrustumCulling(disabled)
            }
            ; (window as any).disableFrustumCulling = () => {
                AssetManager.setFrustumCullingEnabled(false)
            }
            ; (window as any).enableFrustumCulling = () => {
                AssetManager.setFrustumCullingEnabled(true)
            }

            // Add material debugging function
            ; (window as any).debugMaterials = () => {
                console.log("🎨 === MATERIAL DEBUG ===")
                console.log(
                    `🎯 Shared material exists: ${!!BurgerShopDemo.getSharedMaterial()}`,
                )

                const shared = BurgerShopDemo.getSharedMaterial()
                if (shared) {
                    console.log(`  Type: ${shared.type}`)
                    console.log(`  Color: ${shared.color.getHexString()}`)
                    console.log(`  Emissive: ${shared.emissive.getHexString()}`)
                    console.log(`  Has texture map: ${!!shared.map}`)
                    console.log(`  Has gradientMap: ${!!(shared as any).gradientMap}`)
                    if (shared.map) {
                        console.log(`  Texture source: ${shared.map.image?.src || "unknown"}`)
                    }
                }

                // Check environment level
                if (this.environment) {
                    const envComponent = this.environment.getComponent(
                        BurgerShopEnvironment,
                    )
                    if (envComponent) {
                        console.log(
                            `🏗️ Environment Level: ${envComponent.getCurrentLevel()}`,
                        )
                    }
                }
            }

            // Add tutorial debugging function
            ; (window as any).debugTutorial = () => {
                console.log("🎯 === TUTORIAL DEBUG ===")
                if (this.tutorialSystem) {
                    const debugInfo = this.tutorialSystem.getDebugInfo()
                    console.log("Tutorial System Info:", debugInfo)
                    console.log("Current Tutorial Steps:")
                    this.tutorialSystem.getTutorialSteps().forEach((step, index) => {
                        const isCompleted = this.tutorialSystem!.isStepCompleted(step.id)
                        const canDisplay = step.displayCondition
                            ? step.displayCondition()
                            : true
                        const isComplete = step.completeCondition()
                        console.log(`  ${index + 1}. ${step.id} - "${step.description}"`)
                        console.log(
                            `     Completed: ${isCompleted}, Can Display: ${canDisplay}, Is Complete: ${isComplete}`,
                        )
                    })

                    // Extra debug for tutorial tracker
                    const tracker = this.tutorialSystem.getTracker()
                    console.log("🎯 Tutorial Tracker Data:")
                    console.log("  Burgers picked up:", tracker.getBurgersPickedUp())
                    console.log(
                        "  Burgers delivered to checkout:",
                        tracker.getBurgersDeliveredToCheckout(),
                    )
                    console.log("  Customers served:", tracker.getCustomersServed())
                    console.log(
                        "  Time since trash acquired:",
                        tracker.getTimeSinceTrashAcquired(),
                    )
                    console.log(
                        "  Time since shop purchased:",
                        tracker.getTimeSinceShopPurchased(),
                    )
                    console.log(
                        "  Trash picked up from tables:",
                        tracker.getTrashPickedUpFromTables(),
                    )
                    console.log(
                        "  Trash disposed in trash can:",
                        tracker.getTrashDisposedInTrashCan(),
                    )
                    console.log(
                        "  Time since first dirty table:",
                        tracker.getTimeSinceFirstDirtyTable(),
                    )
                    console.log(
                        "  Time since first trash pickup:",
                        tracker.getTimeSinceFirstTrashPickup(),
                    )
                    console.log("  Has dirty tables:", tracker.hasDirtyTables())
                } else {
                    console.log("Tutorial system not initialized")
                }
            }

            // Add tutorial reset function for debug menu
            ; (window as any).resetTutorial = async () => {
                console.log("🎯 Resetting tutorial system...")

                if (!this.tutorialSystem) {
                    console.log("❌ Tutorial system not initialized")
                    return
                }

                // Use the tutorial system's reset method which handles everything
                await this.tutorialSystem.reset()

                console.log(
                    "✅ Tutorial reset complete - refresh page to see tutorials from beginning",
                )
            }

            // Add unlock highlight debug function
            ; (window as any).debugUnlockHighlight = () => {
                console.log("🎬 === UNLOCK HIGHLIGHT DEBUG ===")
                if (this.unlockHighlightSystem) {
                    const debugInfo = this.unlockHighlightSystem.getDebugInfo()
                    console.log("Unlock Highlight Info:", debugInfo)
                } else {
                    console.log("Unlock highlight system not initialized")
                }
            }

            // Add test function for unlock highlighting
            ; (window as any).testUnlockHighlight = () => {
                console.log("🎬 Testing unlock highlight system...")
                if (this.unlockHighlightSystem && this.checkoutStation) {
                    // Simulate highlighting the checkout station
                    this.unlockHighlightSystem.onItemAcquired(this.burgerStation, [
                        this.checkoutStation,
                    ])
                    console.log("✅ Test unlock highlight triggered")
                } else {
                    console.log("❌ Missing components for test")
                }
            }

            // Add car debugging functions
            ; (window as any).debugCarRendering = () => {
                console.log("🚗 === CAR RENDERING DEBUG ===")
                console.log(
                    `🎯 Frustum culling enabled: ${AssetManager.isFrustumCullingEnabled()}`,
                )

                if (this.carManager) {
                    const activeCars = this.carManager.getActiveCars()
                    console.log(`📊 Active cars: ${activeCars.length}`)

                    activeCars.forEach((car, i) => {
                        const gameObject = car.getCarGameObject()
                        if (gameObject) {
                            const worldPos = new THREE.Vector3()
                            gameObject.getWorldPosition(worldPos)
                            console.log(
                                `  Car ${i + 1}: Position (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)}) Enabled: ${gameObject.isEnabled()}`,
                            )

                        }
                    })
                } else {
                    console.log("❌ No car manager found")
                }

                // Check GPU batches for car assets
                const stats = AssetManager.getGlobalInstanceStats()
                console.log(
                    `🎮 GPU instances: ${stats.gpuInstances}, batches: ${stats.gpuBatches}`,
                )

                // Check for car assets in AssetManager
                const carAssets = [
                    "restaurant_display_Car_1",
                    "restaurant_display_Car_2",
                    "restaurant_display_Car_3",
                ]
                carAssets.forEach((assetPath) => {
                    try {
                        AssetManager.requireAsset(assetPath)
                        // Asset checked
                    } catch (error) {
                        console.log(
                            `📦 Asset ${assetPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
                        )
                    }
                })
            }

            // Make unlock manager debug function globally available
            ; (window as any).debugClearAllProgress = async () => {
                try {
                    console.log("🧹 Clearing all game progress...")

                    // Clear unlock/acquire + money + purchase areas
                    await UnlockManager.debugClearAll()
                    console.log("✅ UnlockManager cleared")

                    // Clear upgrade station levels
                    const { UpgradeManager } = await import(
                        "../burgershop/upgrade-station/UpgradeManager"
                    )
                    await UpgradeManager.clearStorage()
                    console.log("✅ UpgradeManager storage cleared")

                    // Clear station level upgrades (burger station, grill, etc.)
                    await StationLevelManager.clearStorage()
                    console.log("✅ StationLevelManager cleared")

                    // Clear HR upgrade levels
                    const { HRUpgradeManager } = await import(
                        "../burgershop/employee/HRUpgradeManager"
                    )
                    await HRUpgradeManager.debugClearAll()
                    console.log("✅ HRUpgradeManager cleared")

                    // Clear tutorial progress - MUST complete before refresh
                    if (this.tutorialSystem) {
                        await this.tutorialSystem.reset()
                        console.log("✅ Tutorial progress cleared")
                    } else {
                        console.log("⚠️ Tutorial system not available")
                    }

                    // Clear ad purchase state
                    if (this.timedAdSystem) {
                        await this.timedAdSystem.debugResetAdPurchase()
                        console.log("✅ Ad purchase state cleared")
                    } else {
                        console.log("⚠️ TimedAdSystem not available")
                    }

                    console.log("✅ All progress cleared successfully")

                    // Allow a brief moment for any final async operations to complete
                    // This is much shorter than the previous arbitrary 100ms and more predictable
                    await new Promise((resolve) => setTimeout(resolve, 50))

                    console.log("🔄 Refreshing page...")
                    window.location.reload()
                } catch (error) {
                    console.error("❌ Error during progress clearing:", error)
                    // Still try to reload even if there was an error
                    console.log("🔄 Attempting page refresh despite errors...")
                    window.location.reload()
                }
            }
            // Add HR upgrades debug clear
            ; (window as any).debugClearHRUpgrades = async () => {
                const { HRUpgradeManager } = await import(
                    "../burgershop/employee/HRUpgradeManager"
                )
                await HRUpgradeManager.debugClearAll()
                console.log("📋 HR upgrades cleared")
            }

            // Make path visualization functions globally available for easy testing
            ; (window as any).testCustomerPath = () => {
                console.log("🛤️ Testing customer spawn to checkout path...")
                PathVisualization.setVisualizationEnabled(true)
                PathVisualization.testPath(-8, -30, -1, -2) // Spawn to checkout
            }
            ; (window as any).testCheckoutToTable = () => {
                console.log("🛤️ Testing checkout to table path...")
                PathVisualization.setVisualizationEnabled(true)
                PathVisualization.testPath(-1, -2, -6, 0) // Checkout to first table
            }
            ; (window as any).visualizeCurrentCustomerPaths = () => {
                console.log(
                    "🛤️ Enabling path visualization for current customer movements...",
                )
                PathVisualization.setVisualizationEnabled(true)

                // Enable visualization for all nav agents
                const customers = document.querySelectorAll('[data-component="Customer"]')
                console.log(
                    `🛤️ Found ${customers.length} customers to enable path visualization for`,
                )
            }

            // DEBUG: Helper function to remove all debug visuals
            ; (window as any).removeDebugVisuals = () => {
                console.log("🧹 Removing all debug visuals...")

                // Remove line position indicators
                const lineIndicators = document.querySelectorAll(
                    '[style*="position: absolute"][style*="background: rgba(255, 255, 255, 0.9)"]',
                )
                lineIndicators.forEach((indicator) => indicator.remove())

                console.log("✅ Debug visuals removed")
            }

            // Quick enable function for customer debug
            ; (window as any).enableCustomerDebug = () => {
                console.log("🎯 Enabling customer debug visuals...")
                    ; (window as any).customerDebugEnabled = true
                console.log(
                    "✅ Customer debug enabled - line positions will show above customers",
                )
            }

            // Drive-thru debug functions
            ; (window as any).debugDriveThru = () => {
                console.log("🚗 Drive-thru Debug Info:")
                if (this.carManager) {
                    const activeCars = this.carManager.getActiveCars()
                    const carsInLine = this.carManager.getCarsInLine()
                    const frontCar = this.carManager.getFrontCar()

                    console.log(`  Active cars: ${activeCars.length}`)
                    console.log(`  Cars in line: ${carsInLine.length}`)
                    console.log(
                        `  Front car: ${frontCar ? `Car with ${frontCar.getBurgerOrderCount()} burger order` : "None"}`,
                    )

                    activeCars.forEach((car, i) => {
                        console.log(
                            `    Car ${i + 1}: Model ${car.getCarModelIndex()}, Orders ${car.getBurgerOrderCount()}, State ${car.getState()}`,
                        )
                    })
                } else {
                    console.log("  No car manager found")
                }
            }
            ; (window as any).removeFrontCar = () => {
                console.log("🚗 Removing front car from line...")
                if (this.carManager) {
                    this.carManager.removeFrontCarFromLine()
                    console.log("✅ Front car removed")
                } else {
                    console.log("❌ No car manager found")
                }
            }

            // Employee debug functions
            // TODO: Fix error with getCompoennt
            // ;(window as any).debugEmployees = () => {
            //   console.log("👨‍💼 Employee Debug Info:")
            //   this.scene.traverse((object) => {
            //     if (object instanceof GameObject && object.name.includes("Employee")) {
            //       const employeeComponent = object.getComponent("Employee")
            //       if (
            //         employeeComponent &&
            //         typeof (employeeComponent as any).getStatus === "function"
            //       ) {
            //         console.log(`  ${(employeeComponent as any).getStatus()}`)
            //       }
            //     }
            //   })
            // }

            // Debug functions available
            // Debug functions registered (use browser console to access)

            // Add employee position debugging
            ; (window as any).debugEmployeePositions = () => {
                console.log("🧑‍💼 Employee Position Debug:")
                const employees = this.scene.children.filter((obj) =>
                    obj.name.includes("Employee"),
                )
                employees.forEach((emp, i) => {
                    console.log(
                        `Employee ${i + 1} (${emp.name}): Position (${emp.position.x.toFixed(2)}, ${emp.position.y.toFixed(2)}, ${emp.position.z.toFixed(2)})`,
                    )

                    // Check if employee has rigidbody component
                    const rigidBodyComp = (emp as any).components?.find(
                        (comp: any) => comp.constructor.name === "RigidBodyComponentThree",
                    )
                    if (rigidBodyComp && rigidBodyComp.rigidBody) {
                        const physicsPos = rigidBodyComp.rigidBody.translation()
                        console.log(
                            `  Physics Position: (${physicsPos.x.toFixed(2)}, ${physicsPos.y.toFixed(2)}, ${physicsPos.z.toFixed(2)})`,
                        )

                        // Check trigger registration
                        const bodyId = (rigidBodyComp as any).bodyId
                        console.log(`  Physics Body ID: ${bodyId}`)

                        // Check if it has a collider
                        const collider = (rigidBodyComp as any).collider
                        if (collider) {
                            console.log(`  Is Sensor: ${collider.isSensor()}`)
                        } else {
                            console.log(`  No collider found`)
                        }
                    }

                    // Check employee component
                    const employeeComp = (emp as any).components?.find(
                        (comp: any) => comp.constructor.name === "Employee",
                    )
                    if (employeeComp) {
                        console.log(`  Employee State: ${employeeComp.getCurrentState()}`)
                        console.log(`  Employee Task: ${employeeComp.getCurrentTask()}`)
                    }
                })
            }

        this.endTimingStep("Global Debug Functions Setup")

        RundotGameAPI.analytics.trackFunnelStep(2, "Game Setup Completed")

        RundotGameAPI.preloader.hideLoadScreen();

        // Log complete setup timing summary
        this.logTimingSummary()


    }

    private async preloadAssets(): Promise<void> {
        const { AnimationLibrary } = await import("@series-inc/rundot-3d-engine/systems")
        const stowkit = StowKitSystem.getInstance()

        // Register animations with AnimationLibrary (already loaded in loadStowKitAssets)
        const animationMap: Record<string, string> = {
            "idle": "anim_idle",
            "walk": "anim_walk",
            "carry_idle": "anim_idle_carry",
            "carry_walk": "anim_walk_carry",
            "sitting_eating": "anim_sit_eat",
            "sitting_eating_shovel": "anim_sit_eat_shovel",
            "using_bathroom": "anim_sit_toilet",
            "pee_dance": "anim_idle_pee_dance",
            "idle_wait": "anim_idle_wait",
            "idle_cashier": "anim_idle_cashier_v2",
            "idle_to_toilet": "anim_idle_to_toilet",
            "throw": "anim_throw",
            "interact_kiosk": "anim_interact_kiosk",
        }

        for (const [key, animName] of Object.entries(animationMap)) {
            const clip = stowkit.getAnimationSync(animName)
            if (clip) {
                AnimationLibrary.registerClip(key, clip)
            }
        }

        console.log("✅ Character animations registered with AnimationLibrary")
    }

    private sharedAnimManager: any = null // SharedAnimationManager instance

    /**
     * Initialize all Three.js systems
     */
    private async initializeSystems(): Promise<void> {
        this.startTimingStep("AssetManager Initialization")
        AssetManager.init(this.scene)
        this.endTimingStep("AssetManager Initialization")

        // Setup costs BEFORE parallel initialization so MoneySystem can access starting_money
        this.startTimingStep("Cost Manager Setup")
        this.setupCosts()
        this.endTimingStep("Cost Manager Setup")

        // Run all independent async operations in parallel
        this.startTimingStep("Parallel Async Operations (Storage Loads)")
        const [settings] = await Promise.all([
            (async () => {
                const settings = Settings.getInstance()
                await settings.load()
                return settings
            })(),
            PhysicsSystem.initialize(),
            MoneySystem.initialize(),
            UnlockManager.initialize(),
            StationLevelManager.initialize(),
            (async () => {
                this.upgradeManager = new UpgradeManager()
                await this.upgradeManager.initialize()
            })(),
            (async () => {
                this.hrUpgradeManager = new HRUpgradeManager()
                await this.hrUpgradeManager.initialize()
            })(),
            TutorialTracker.initialize(),
        ])
        this.endTimingStep("Parallel Async Operations (Storage Loads)")

        this.startTimingStep("Post-Parallel Setup")
        // Set up SharedAnimationManager
        this.sharedAnimManager = SharedAnimationManager.getInstance()
        AssetManager.setBaseUrl("assets/models/")

        // Apply settings
        SetAudioMuted(settings.isAudioMuted)

        // Physics debug (needs PhysicsSystem initialized)
        PhysicsSystem.initializeDebug(this.scene)

        // All synchronous initializations
        DynamicNavSystem.initialize(this.scene, 140, 140, 1)
        PathVisualization.initialize(this.scene)
        UISystem.initialize()
        // Configure UI scaling: use height-based scaling (match=1) for better portrait mobile support
        // Reference: 1920x1080, match: 1 (height only), min: 0.5, max: 1.5
        UISystem.configureScaling(1920, 1080, 1.0, 0.5, 1.5)

        // Create systems
        this.createTutorialSystem()
        this.createUnlockHighlightSystem()

        // Initialize MoneyUI (import already done in parallel)
        const moneySystemInstance = MoneySystem.getInstance()
        MoneyUI.initialize()
        MoneyChangeIndicator.getInstance(moneySystemInstance)

        // Final setup
        this.setupShop()
        this.setupMuteButton()
        this.endTimingStep("Post-Parallel Setup")
    }

    /**
     * Load all assets from build.json.
     * Packs are auto-loaded from prefab mounts.
     */
    private async loadStowKitAssets(): Promise<void> {
        const stowkit = StowKitSystem.getInstance()

        // Load everything from build.json - this auto-loads all packs from prefab mounts
        const buildJson = (await import("../../prefabs/build.json")).default
        this.prefabCollection = await stowkit.loadFromBuildJson(buildJson, {
            materialConverter: (mat) => MaterialUtils.convertToToon(mat),
            fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path)
        })

        // TODO: Character pack should be added to prefab mounts instead of loading manually
        // This is a temporary solution until characters are properly integrated into the prefab system
        await stowkit.loadPack("character", "character.stow")

        // Load characters for AssetManager registration (needed for SkeletalRenderer)
        const characterScale = 1.2 // Exported at 100x size
        const characterNames = [
            "character_main_character",
            "character_employee_01",
            "character_cashier",
            "character_f_dresscardigan_blue",
            "character_f_dresscardigan_green",
            "character_f_dresscardigan_pink",
            "character_f_dresscardigan_teal",
            "character_f_managerhr_blue",
            "character_f_managerhr_green",
            "character_f_managerhr_maroon",
            "character_f_managerhr_red",
            "character_m_suitcasual50_brown",
            "character_m_suitcasual50_green",
            "character_m_suitcasual50_navy",
            "character_m_suitcasual50_pink",
            "character_m_suitcasual50_tan",
        ]
        for (const name of characterNames) {
            const mesh = await stowkit.getSkinnedMesh(name, characterScale)
            AssetManager.registerSkeletalModel(`stowkit://${name}`, mesh)
        }

        // Load animations for AnimationLibrary registration
        const animationNames = [
            "anim_idle", "anim_walk", "anim_idle_carry", "anim_walk_carry",
            "anim_sit_eat", "anim_sit_eat_shovel", "anim_sit_toilet",
            "anim_idle_pee_dance", "anim_idle_cashier_v2", "anim_idle_wait",
            "anim_idle_to_toilet", "anim_throw", "anim_interact_kiosk"
        ]
        for (const name of animationNames) {
            await stowkit.getAnimation(name, "character_cashier")
        }

        // Load and map audio to banks
        const musicTrackNames = ["track_01", "track_02", "track_03", "track_04"]
        const audioNames = [
            ...musicTrackNames, "cash register", "character enter", "character_upgrade",
            "click", "click_open", "firework_explosion", "firework_whistle", "initial_unlock",
            "pick up cash", "pick up", "place burgers", "sell alternate", "sell", "trash",
            "unlock", "upgrade", "upgrade2"
        ]
        for (const name of audioNames) {
            const audio = await stowkit.getAudio(name)
            if (musicTrackNames.includes(name)) {
                MusicBank[name] = audio
            } else {
                Main2DAudioBank[name] = audio
            }
        }

        // Start music immediately after audio is loaded (during loading screen)
        try {
            SetMusicVolume(Math.max(0, MusicSystem.volume - 0.2), MusicBank)
            StartPlaylistWithAutoplayHandling(MusicBank, musicTrackNames)
        } catch (e) {
            console.warn("Could not start music during load:", e)
        }

        // Register instanced meshes from prefabs (auto-grows as needed)
        await stowkit.registerBatchFromPrefab("burger")
        await stowkit.registerBatchFromPrefab("shake")
        await stowkit.registerBatchFromPrefab("trash_1")
        await stowkit.registerBatchFromPrefab("trash_2")
        await stowkit.registerBatchFromPrefab("patty")
        await BlobShadow.registerBatch()
    }

    /**
     * Create tutorial system as a GameObject component
     */
    private createTutorialSystem(): void {
        this.tutorialSystemObject = new GameObject("TutorialSystem")
        this.tutorialSystem = new TutorialSystemComponent()
        this.tutorialSystemObject.addComponent(this.tutorialSystem)
        // GameObject automatically adds itself to the scene in constructor

        // Register with directory for easy access by other components
        BurgerShopDirectory.registerTutorialSystem(this.tutorialSystem)
    }

    /**
     * Set up the shop system - TimedAdSystem will add purchase items
     */
    private setupShop(): void {
        const shopSystem = ShopSystem.initialize()

        // Shop system initialized - TimedAdSystem will add "Remove All Ads" purchase
        console.log("🛒 Shop system initialized (items added by other systems)")
    }

    /**
     * Set up the mute buttons (music and all audio)
     */
    private setupMuteButton() {
        const settings = Settings.getInstance()
        
        // Default music volume (matches the initial SetMusicVolume call in loadAudio)
        const DEFAULT_MUSIC_VOLUME = 0.3

        // Set up music mute button
        const muteMusicButton = MuteMusicButton.getInstance()
        muteMusicButton.setMuted(settings.isMusicMuted)
        // Apply initial music mute state
        if (settings.isMusicMuted) {
            SetMusicVolume(0, MusicBank)
        }
        muteMusicButton.initialize(async () => {
            settings.isMusicMuted = muteMusicButton.isMuted
            // Set music volume to 0 when muted, restore to default when unmuted
            SetMusicVolume(muteMusicButton.isMuted ? 0 : DEFAULT_MUSIC_VOLUME, MusicBank)
            await settings.save()
        })
        console.log("🎵 Music mute button initialized")

        // Set up all audio mute button
        const muteButton = MuteButton.getInstance()
        muteButton.setMuted(settings.isAudioMuted)
        muteButton.initialize(async () => {
            settings.isAudioMuted = muteButton.isMuted
            SetAudioMuted(settings.isAudioMuted)
            await settings.save()
        })
        console.log("🔊 All audio mute button initialized")
    }

    /**
     * Create unlock highlight system as a GameObject component
     */
    private createUnlockHighlightSystem(): void {
        this.unlockHighlightObject = new GameObject("UnlockHighlightSystem")
        this.unlockHighlightSystem = new UnlockHighlightSystem()
        this.unlockHighlightObject.addComponent(this.unlockHighlightSystem)
        // GameObject automatically adds itself to the scene in constructor
    }

    /**
     * Create timed ad system as a GameObject component
     */
    private createTimedAdSystem(
        player: GameObject,
        shopSystem: ShopSystem,
    ): void {
        this.timedAdSystemObject = new GameObject("TimedAdSystem")
        this.timedAdSystem = new TimedAdSystem(player, shopSystem, this.driveThru)
        this.timedAdSystemObject.addComponent(this.timedAdSystem)
    }

    /**
     * Set up scene environment.
     * Note: Most rendering settings (shadows, tone mapping, background color) are now
     * handled by VenusGame via getConfig(). This method only sets up game-specific options.
     */
    private setupSceneEnvironment(): void {
        // Performance optimizations
        this.renderer.info.autoReset = false // Manual reset for performance monitoring

        // Add procedural sky
        this.setupSky()
    }

    /**
     * Set up procedural sky shader
     */
    private setupSky(): void {
        const sky = new Sky()
        sky.scale.setScalar(10000)
        this.scene.add(sky)

        // Sky shader uniforms
        const skyUniforms = sky.material.uniforms

        // Atmospheric scattering parameters - lower values for cleaner look
        skyUniforms["turbidity"].value = 1
        skyUniforms["rayleigh"].value = 0.5
        skyUniforms["mieCoefficient"].value = 0.001
        skyUniforms["mieDirectionalG"].value = 0.8

        // Sun behind camera and below horizon - gives clean blue gradient
        const sunPosition = new THREE.Vector3(0, -0.01, 1)
        skyUniforms["sunPosition"].value.copy(sunPosition)
    }

    /**
     * Set up proper Three.js lighting (direct approach)
     */
    private setupLighting(): void {
        // Simple mobile detection
        const isMobile =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent,
            ) || window.innerWidth < 768

        // Platform detection for mobile optimizations

        // 1. Main Directional Light - primary light with shadows
        const directionalLight = new THREE.DirectionalLight(
            new THREE.Color(1.0, 0.98, 0.94), // Subtle warm sunlight tint
            1.0, // Reduced from 1 to prevent overexposure
        )
        directionalLight.position.set(0, 10, -3)
        directionalLight.castShadow = true

        // Set fixed light direction (like sun)
        this.scene.add(directionalLight)

        // Set light to look at origin - direction stays constant
        directionalLight.target.position.set(0, 0, 0)
        this.scene.add(directionalLight.target)

        // Store directional light reference for shadow following
        this.directionalLight = directionalLight

        // Shadow settings - adjust based on platform but keep working values
        if (isMobile) {
            // Mobile: higher resolution + tighter frustum for better quality
            directionalLight.shadow.mapSize.width = 512
            directionalLight.shadow.mapSize.height = 512
            directionalLight.shadow.camera.near = -50
            directionalLight.shadow.camera.far = 50
            directionalLight.shadow.camera.left = -35
            directionalLight.shadow.camera.right = 35
            directionalLight.shadow.camera.top = 35
            directionalLight.shadow.camera.bottom = -35
            directionalLight.shadow.bias = -0.0005
            directionalLight.shadow.normalBias = 0.1
            directionalLight.shadow.radius = 1.2
            directionalLight.shadow.blurSamples = 2

            // Softer filtered shadows on mobile
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        } else {
            // Desktop settings - back to original working values
            directionalLight.shadow.mapSize.width = 1024
            directionalLight.shadow.mapSize.height = 1024
            directionalLight.shadow.camera.near = -50 // Original working value
            directionalLight.shadow.camera.far = 50
            directionalLight.shadow.camera.left = -50 // Original bounds
            directionalLight.shadow.camera.right = 50
            directionalLight.shadow.camera.top = 50
            directionalLight.shadow.camera.bottom = -50
            directionalLight.shadow.bias = -0.0005 // Original working bias
            directionalLight.shadow.normalBias = 0.1 // Original working normal bias
            directionalLight.shadow.radius = 1.5
            directionalLight.shadow.blurSamples = 5

            // Keep VSM shadows for desktop as in original
            this.renderer.shadowMap.type = THREE.VSMShadowMap
        }

        // // 2. Secondary Directional Light - fill light from opposite side (NO SHADOWS)
        // const fillLight = new THREE.DirectionalLight(
        //   new THREE.Color(0.7, 0.8, 1.0), // Cool blue fill light
        //   0.2, // Increased intensity to better fill shadows
        // )
        // fillLight.position.set(-10, -45, -25)
        // fillLight.castShadow = false // No shadows - just fills in dark areas
        // this.scene.add(fillLight)

        // 3. Ambient light for general fill (increased)
        const ambientLight = new THREE.AmbientLight(
            new THREE.Color(1.0, 0.97, 0.92), // Warm ambient fill
            1.0, // Bump ambient brightness slightly
        )
        this.scene.add(ambientLight)

        // Lighting setup complete
    }

    /**
     * Set up camera system with component-based architecture
     */
    private setupCameraSystem(): void {
        if (!this.player) {
            console.error("Player must be created before camera setup")
            return
        }

        // Create camera GameObject
        this.cameraObject = new GameObject("CameraManager")

        // Add camera manager component
        this.cameraManager = new CameraManager()
        this.cameraObject.addComponent(this.cameraManager)

        // Initialize camera manager with the main camera and canvas
        this.cameraManager.initialize(this.camera, this.canvas)

        // Set the player as the target to follow
        this.cameraManager.setTarget(this.player)

        // Enable animation frustum culling with this camera
        // Characters outside the view will skip animation updates for better performance
        // frustumExpansion 1.5 = bounding sphere is 50% larger than actual character (2 * 1.5 = 3 unit radius)
        VenusGame.setAnimationCullingCamera(this.camera, 3)

        // Register camera manager and player with directory for global access
        BurgerShopDirectory.registerCameraManager(this.cameraManager)
        BurgerShopDirectory.registerPlayer(this.player)
    }

    /**
     * Set up the title screen that displays on game start
     * Shows "Burger Shop Rush" title and waits for user click before starting gameplay
     */
    private setupTitleScreen(): void {
        if (!this.cameraManager || !this.player || !this.initialShopPurchase) {
            console.warn("TitleScreen: Missing required components, skipping title screen")
            return
        }

        try {
            // Get the title camera position from prefab
            // The prefab should have a child object named "title_camera_position"
            const titleCameraPrefab = this.instantiate("/title_camera_position")

            // Hide UI elements during title screen
            const moneyUI = MoneyUI.getInstance()
            const muteButton = MuteButton.getInstance()
            const muteMusicButton = MuteMusicButton.getInstance()
            
            if (moneyUI) moneyUI.hide()
            muteButton.hide()
            muteMusicButton.hide()
            if (this.tutorialSystem) this.tutorialSystem.setEnabled(false)

            // Create the title screen GameObject and component
            const titleScreenObject = new GameObject("TitleScreen")
            const titleScreen = new TitleScreen(
                this.cameraManager,
                this.player,
                this.initialShopPurchase,
                titleCameraPrefab,
                // Callback when title screen transition completes
                () => {
                    // Show UI elements after title screen transition
                    if (moneyUI) moneyUI.show()
                    muteButton.show()
                    muteMusicButton.show()
                    if (this.tutorialSystem) this.tutorialSystem.setEnabled(true)
                }
            )
            titleScreenObject.addComponent(titleScreen)

            console.log("✅ Title screen initialized")
        } catch (error) {
            // If prefab doesn't exist, skip title screen and enable player immediately
            console.warn("TitleScreen: Could not load title_camera_position prefab, skipping title screen:", error)
            
            // Start the camera in follow mode since there's no title screen
            this.cameraManager.start()
            
            // Make sure player movement is enabled if we skip title screen
            const playerComponent = this.player.getComponent(PlayerComponent)
            if (playerComponent) {
                playerComponent.setMovementEnabled(true)
            }
        }
    }

    /**
     * Set up debug panel for debugging and performance monitoring
     */
    private setupDebugPanel(): void {
        this.debugPanel = new BurgerShopDebugPanel(this) // Pass this as the free camera controller

        // Set the renderer for draw call tracking
        this.debugPanel.setRenderer(this.renderer)

        // Set the player GameObject for position tracking
        if (this.player) {
            this.debugPanel.setPlayerGameObject(this.player)
        }

        // Post-processing completely disabled - no debug option needed
        // this.debugPanel.setPostProcessingCallback((checked: boolean) => {
        //   this.usePostProcessing = checked;
        // });
    }

    /**
     * Create the game world with burger shop elements
     */
    private async createGameWorld(): Promise<void> {
        // Create player
        this.createPlayer()

        // Create initial shop purchase (blocks entrance initially)
        this.createInitialShopPurchase()

        // Create burger station
        this.createBurgerStation()

        // Create second burger station
        this.createBurgerStation2()

        // Create checkout station
        this.createCheckoutStation()

        // Create cashier station
        this.createCashierStation()

        // Create tables for customers
        this.createTables()

        // Create trash cans
        this.createTrashCans()

        // Initialize customer configuration before spawners
        this.initializeCustomerConfig()

        // Create customer spawner
        this.createCustomerSpawner()

        // Create self-checkout customer spawner
        this.createSelfCheckoutCustomerSpawner()

        // Create VIP customer spawner
        this.createVIPCustomerSpawner()

        // Create drive-thru system
        this.createDriveThru()

        // Create drive-thru cashier station
        this.createDriveThruCashierStation()

        // Create upgrade station and initialize manager
        this.createUpgradeStation()

        // Create HR station and initialize manager
        this.createHRStation()

        // Create expansion station (before environment so we can pass it as requirement)
        this.createExpansionStation()

        // Create patio station (unlocked after expansion 1, required for patio tables)
        this.createPatioStation()

        // Create bathroom stations
        this.createBathroomStations()

        // Create second expansion station
        this.createExpansionStation2()

        // Create shake stations (unlocked after expansion 3)
        this.createShakeStation()
        this.createShakeCheckout()
        this.createShakeCheckoutCashierStation()
        this.createShakeStation2()

        // Create self-checkout station
        this.createSelfCheckoutStation()

        // Create shake customer spawner
        this.createShakeCustomerSpawner()

        // Create environment (after all unlockable items so we can pass unlock requirements)
        this.createEnvironment()

        // Create pickup spawner
        this.createPickupSpawner()

        // Create ad system after all stations (needs player and drive-thru reference)
        const shopSystem = ShopSystem.getInstance()
        this.createTimedAdSystem(this.player!, shopSystem)

        // Setup unlock dependencies after all stations are created
        this.setupUnlocks()

        // Initialize leveling system last (after all unlockables are registered)
        // Calculate adjusted thresholds by adding starting money to each level requirement
        const adjustedThresholds = LEVEL_XP_THRESHOLDS.map(threshold => threshold + COST_STARTING_MONEY)
        LevelingSystem.initialize(adjustedThresholds)
    }

    /**
     * Create the player character with Three.js components
     */
    private createPlayer(): void {
        this.player = new GameObject("Player")

        // Check if burger shop is already purchased to determine starting position
        const isShopPurchased = this.checkIfShopAlreadyPurchased()
        if (isShopPurchased) {
            this.player.position.set(15, 0, 0) // Start at origin if shop is purchased
            this.player.rotation.set(0, Math.PI, 0) // 90 degree rotation
        } else {
            this.player.position.set(-1, 0, -27) // Start player behind the door, with clear view of purchase area
        }

        // Add the PlayerComponent which handles display, physics, and movement
        const playerComponent = new PlayerComponent()
        this.player.addComponent(playerComponent)

        // Set camera reference for camera-relative movement
        playerComponent.setCamera(this.camera)

        // Register the player
        BurgerShopDirectory.registerPlayer(this.player)
    }

    /**
     * Check if the burger shop has been purchased in a previous session
     */
    private checkIfShopAlreadyPurchased(): boolean {
        try {
            // Check if the initial shop purchase is in the acquired items from storage
            // We need to check using the storage directly since the component hasn't been created yet
            const acquiredItems = UnlockManager.getAcquiredItems()

            // The initial shop purchase will be identified by its component when it's created
            // For now, we can check if any items are acquired (which would indicate shop was purchased)
            // since initial shop purchase is the first required purchase
            return acquiredItems.length > 0
        } catch (error) {
            console.warn(
                "Could not check shop purchase status, defaulting to unpurchased:",
                error,
            )
            return false
        }
    }

    /**
     * Create the complete burger shop environment
     */
    private createEnvironment(): void {
        const environment = new GameObject("Environment")

        // Define level unlocks: index 0 = Level 1, index 1 = Level 2, etc.
        const environmentComponent = new BurgerShopEnvironment([
            this.tables[1],  // Level 1: Table 2 unlocked
            this.expansionStation2,
        ])
        environment.addComponent(environmentComponent)

        this.environment = environment
        BurgerShopDirectory.registerEnvironment(environmentComponent)
    }

    /**
     * Create initial shop purchase that blocks entrance until bought
     */
    private createInitialShopPurchase(): void {
        const shopPurchaseObject = new GameObject("InitialShopPurchase")
        shopPurchaseObject.position.set(0, 0, 0)

        this.initialShopPurchase = new InitialShopPurchase()
        shopPurchaseObject.addComponent(this.initialShopPurchase)
    }

    /**
     * Create burger station config factory
     */
    private createBurgerStationConfig(prefabInstance: PrefabInstance, costKey: string, displayName: string, upgradeStartUnlocked: boolean): ProductionStationConfig {

        const stationDisplay = prefabInstance.getDescendantByPathOrThrow("burger_station_display")
        const purchaseArea = prefabInstance.getDescendantByPathOrThrow("purchase_area")
        const grillDisplay = stationDisplay.getDescendantByPathOrThrow("display_grill")
        const counterProject = stationDisplay.getDescendantByPathOrThrow("display_counter")
        const upgradeArea = stationDisplay.getDescendantByPathOrThrow("upgrade_area")
        
        // Get burger patty positions from prefab children
        const burger1Position = stationDisplay.getDescendantByPathOrThrow("burger1").gameObject.position.clone()
        const burger2Position = stationDisplay.getDescendantByPathOrThrow("burger2").gameObject.position.clone()
        
        return {
            stationComponentsObject: stationDisplay.gameObject,
            mainObject: grillDisplay.gameObject,
            counterObject: counterProject.gameObject,
            purchaseAreaObject: purchaseArea.gameObject,
            upgradeObject: upgradeArea.gameObject,
            stackPositions: [
                new THREE.Vector3(0.8, 1.5, 0),
                new THREE.Vector3(0.0, 1.5, 0),
            ],
            itemFactory: () => new Burger(BurgerShopDemo.getSharedMaterial()),
            productionDurations: GRILL_PRODUCTION_DURATIONS,
            maxInventory: GRILL_MAX_INVENTORY,
            visualComponentsFactory: (parent) => {
                // Create burger patties with smoke for visual effects
                const patty1 = new BurgerPatty()
                const patty2 = new BurgerPatty()

                const patty1Obj = new GameObject("BurgerPatty_0")
                patty1Obj.position.copy(burger1Position)
                parent.add(patty1Obj)
                patty1Obj.addComponent(patty1)

                const patty2Obj = new GameObject("BurgerPatty_1")
                patty2Obj.position.copy(burger2Position)
                parent.add(patty2Obj)
                patty2Obj.addComponent(patty2)

                return [patty1, patty2]
            },
            upgradeMeshNames: [
                "restaurant_display_Prop_Grill_L1",
                "restaurant_display_Prop_Grill_L2",
                "restaurant_display_Prop_Grill_L3",
                "restaurant_display_Prop_Grill_L4"
            ],
            upgradeCostKeys: ["grill_upgrade_1", "grill_upgrade_2", "grill_upgrade_3"],
            upgradeLabel: "Grill Upgrade",
            upgradeStartUnlocked,
            costKey,
            displayName,
            purchaseAreaLabel: "Grill",
            purchaseAreaSize: new THREE.Vector2(3.5, 6),
            interactionZonePosition: new THREE.Vector3(-1.25, 0, -1),
            interactionZoneSize: { width: 5, depth: 4.5 },
            upgradePosition: new THREE.Vector3(4.5, 0, 0),
            pickupSoundName: "pick up",
            sharedMaterial: BurgerShopDemo.getSharedMaterial()
        }
    }

    /**
     * Create burger station for testing
     */
    private createBurgerStation(): void {

        const station = this.instantiate("burger_station_0")
        const burgerStationObject = station.gameObject

        this.burgerStation = new ProductionStation(this.createBurgerStationConfig(
            station,
            "burger_station",
            "Burger Station",
            false
        ))

        burgerStationObject.addComponent(this.burgerStation)
        this.burgerStation.setCameraForUI(this.camera)

        // Set main camera for directory system
        BurgerShopDirectory.setMainCamera(this.camera)

        // Connect money system to player
        if (this.player) {
            try {
                MoneySystem.setPlayerGameObject(this.player)
            } catch (error) {
                console.error("❌ Failed to connect money system to player:", error)
            }
        }
    }

    /**
     * Create second burger station
     */
    private createBurgerStation2(): void {
        const burgerStation = this.instantiate("burger_station_1")
        const burgerStationObject = burgerStation.gameObject

        this.burgerStation2 = new ProductionStation(this.createBurgerStationConfig(
            burgerStation,
            "burger_station_2",
            "Burger Station 2",
            true
        ))

        burgerStationObject.addComponent(this.burgerStation2)
        this.burgerStation2.setCameraForUI(this.camera)
    }

    /**
     * Create checkout station with proper unlock integration
     */
    private createCheckoutStation(): void {

        // Create checkout station object
        const checkoutStationInstance = this.instantiate("/checkout_station_0")
        const checkoutStationObject = checkoutStationInstance.gameObject
        const stackPosition = checkoutStationInstance.getDescendantByPathOrThrow("stack_position").gameObject.position.clone()
        
        // Get dropoff area position and size from prefab box component (like HRStation pattern)
        const dropoffAreaPrefabInstance = checkoutStationInstance.getDescendantByPathOrThrow("dropoff_box")
        const dropoffBoxData = dropoffAreaPrefabInstance.prefabNode.getComponentData<BoxComponentJSON>("box")
        if (!dropoffBoxData) {
            throw new Error("Checkout station stack_position must have a box component")
        }
        const dropoffAreaPosition = dropoffAreaPrefabInstance.gameObject.position.clone()

        // Create a spline for the customer line (extends backward from checkout)
        const lineSpline = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 7,
            closed: false,
        })

        const waypoints = this.getPrefab("/customer_line_burger")
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)

        lineSpline.setWaypoints(waypoints)

        const config: CheckoutStationConfig = {
            prefabInstance: checkoutStationInstance,
            itemType: ItemTypes.BURGER,
            costKey: "checkout_station",
            displayName: "Burger Checkout",
            purchaseAreaSize: new THREE.Vector2(3.5, 6),
            dropoffZonePosition: dropoffAreaPosition,
            dropoffZoneSize: { width: dropoffBoxData.size[0], depth: dropoffBoxData.size[2] },
            stackPositions: [
                stackPosition,
            ],
            dropoffAudioClip: "place burgers",
            checkoutZonePosition: new THREE.Vector3(0.5, 0, 2.4),
            checkoutZoneSize: { width: 2, depth: 2 },
            moneyPilePosition: new THREE.Vector3(-4.0, 0, 0),
            itemPriceCostKey: "burger_price",
            customerLinePosition: new THREE.Vector3(1, 0, -2.2),
            lineSpline: lineSpline,
            lineSpacing: 3.0,
            audioClips: ["place burgers", "cash register"]
        }

        this.checkoutStation = new CheckoutStation(config)

        checkoutStationObject.addComponent(this.checkoutStation)
    }

    /**
     * Create cashier station with proper unlock integration
     */
    private createCashierStation(): void {
        // Create cashier station object
        const cashierStationObject = new GameObject("Cashier")

        // Create cashier station component linked to checkout station
        this.cashierStation = new CashierStation(
            this.checkoutStation, // Parent that can have cashier
            "cashier", // Cost key
        )
        cashierStationObject.addComponent(this.cashierStation)

        // CashierStation created
    }

    /**
     * Create tables for customers with proper unlock integration
     */
    private createTables(): void {
        // Table positions based on original BurgerShopSim layout
        const tableConfigs = [
            { costKey: "table1" }, // Table1 - Top right, affordable with starting money
            { costKey: "table2" }, // Table2 - Top left
            { costKey: "table3" }, // Table3 - Bottom left
            { costKey: "table4" }, // Table4 - Bottom right
            { costKey: "table5" }, // Table5 - Right side (advanced)
            { costKey: "table6" }, // Table6 - Far right (advanced)
            { costKey: "table7" }, // Table7 - Far right (advanced)
            { costKey: "table8" }, // Table8 - Far right (advanced)
            { costKey: "table9" }, // Table11 - Bottom right
            { costKey: "table10" }, // Table9 - Bottom left
            { costKey: "table11" }, // Table10 - Bottom right
            { costKey: "table12" }, // Table12 - Expanded area
            { costKey: "table13" }, // Table13 - Expanded area
        ]

        tableConfigs.forEach((config, index) => {

            const prefab = this.instantiate(`table_station_${index}`)
            const tableObject = prefab.gameObject

            // Create table component with shared material
            const table = new Table(prefab, config.costKey)
            tableObject.addComponent(table)

            // Store reference for dependency setup
            this.tables.push(table)
        })
    }

    private instantiate(prefabPath: string) {
        return PrefabLoader.instantiate(this.getPrefab(prefabPath))
    }

    private getPrefab(prefabPath: string) {
        if (!this.prefabCollection) {
            throw new Error("Prefabs were not loaded")
        }

        const restaurantPrefab = this.prefabCollection.getPrefabByName("restaurant")
        if (!restaurantPrefab) {
            throw new Error("Restaurant prefab not found")
        }

        const prefab = restaurantPrefab.getNodeByPath(prefabPath)
        if (prefab == null) {
            throw new Error(`Prefab not found: ${prefabPath}`)
        }
        return prefab
    }

    /**
     * Create trash cans - first one is free from start, second unlocks after first expansion
     */
    private createTrashCans(): void {

        const trashcan1 = this.instantiate("/trash_station_0")
        const trashCan = new TrashCan(trashcan1, 0, true) // Flip label for first trash can
        trashcan1.gameObject.addComponent(trashCan)

        // Store reference for dependency setup
        this.trashCans.push(trashCan)

        const trashcan2 = this.instantiate("/trash_station_1")
        const trashCanObject2 = trashcan2.gameObject

        // Create trash can component (free, unlocks with expansion)
        const trashCan2 = new TrashCan(trashcan2, null) // Free, no purchase needed
        trashCanObject2.addComponent(trashCan2)

        // Store reference for dependency setup
        this.trashCans.push(trashCan2)
    }

    /**
     * Initialize customer configuration with order count ranges per item type
     */
    private initializeCustomerConfig(): void {
        CustomerConfig.setOrderRange(ItemTypes.BURGER, BURGER_ORDER_MIN, BURGER_ORDER_MAX)
        CustomerConfig.setOrderRange(ItemTypes.SHAKE, SHAKE_ORDER_MIN, SHAKE_ORDER_MAX)
    }

    private createPickupSpawner(): void {
        const pickupSpawnerObject = new GameObject("PickupSpawner")
        pickupSpawnerObject.position.set(0, 0, -35)
        // GameObject automatically adds itself to the scene in constructor

        // Get spawn positions from prefabs
        const spawnPositions = this.getPrefab("/pickup_spawn_positions")
            .children
            .filter(child => child.id.startsWith("lvl_"))
            .map(child => child
                .children
                .filter(child => child.id.startsWith("spawn_"))
                .map(child => child.position))

        this.pickupSpawner = new PickupSpawner(spawnPositions, [
            () => new InventoryPickup(PICKUP_INVENTORY_DURATION),
            () => new SpeedPickup(PICKUP_SPEED_DURATION),
            () => new MoneyPickup()
        ], this.camera)
        
        pickupSpawnerObject.addComponent(this.pickupSpawner)
    }

    /**
     * Create customer spawner for managing customer flow (burgers)
     */
    private createCustomerSpawner(): void {
        // Create customer spawner object
        const customerSpawnerObject = new GameObject("CustomerSpawner")
        customerSpawnerObject.position.set(0, 0, -35) // Position outside the store, behind door and player
        // GameObject automatically adds itself to the scene in constructor

        // Get spawn positions from prefabs
        const spawnPositions = this.getPrefab("/customer_spawn_positions_burger")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        const initialSpawnPositions = this.getPrefab("/customer_spawn_positions_burger_initial")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        // Create customer spawner component for burgers
        const customerSpawner = new CustomerSpawner(ItemTypes.BURGER, spawnPositions, initialSpawnPositions)
        customerSpawnerObject.addComponent(customerSpawner)

        // Customer spawner created
    }

    /**
     * Create shake customer spawner for managing shake customer flow
     */
    private createShakeCustomerSpawner(): void {
        // Create shake customer spawner object
        const shakeCustomerSpawnerObject = new GameObject("ShakeCustomerSpawner")
        shakeCustomerSpawnerObject.position.set(-27, 0, -45) // Position outside expanded area
        // GameObject automatically adds itself to the scene in constructor

        // Get spawn positions from prefabs
        const spawnPositions = this.getPrefab("/customer_spawn_positions_burger")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        const initialSpawnPositions = this.getPrefab("/customer_spawn_positions_burger_initial")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        // Create customer spawner component for shakes
        const shakeCustomerSpawner = new CustomerSpawner(ItemTypes.SHAKE, spawnPositions, initialSpawnPositions)
        shakeCustomerSpawnerObject.addComponent(shakeCustomerSpawner)

        // Shake customer spawner created
    }

    /**
     * Create self-checkout customer spawner that generates customers for self-checkout
     */
    private createSelfCheckoutCustomerSpawner(): void {
        const selfCheckoutCustomerSpawnerObject = new GameObject("SelfCheckoutCustomerSpawner")
        selfCheckoutCustomerSpawnerObject.position.set(0, 0, -35)
        // GameObject automatically adds itself to the scene in constructor

        // Get spawn positions from prefabs
        const spawnPositions = this.getPrefab("/customer_spawn_positions_burger")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        // Create self-checkout customer spawner component
        const selfCheckoutCustomerSpawner = new SelfCheckoutCustomerSpawner(spawnPositions)
        selfCheckoutCustomerSpawnerObject.addComponent(selfCheckoutCustomerSpawner)

        // Self-checkout customer spawner created
    }

    /**
     * Create VIP customer spawner
     */
    private createVIPCustomerSpawner(): void {
        const vipCustomerSpawnerObject = new GameObject("VIPCustomerSpawner")
        vipCustomerSpawnerObject.position.set(0, 0, -35)
        // GameObject automatically adds itself to the scene in constructor
        
        // Get spawn positions from prefabs
        const spawnPositions = this.getPrefab("/customer_spawn_positions_burger")
            .children
            .filter(child => child.id.startsWith("spawn_"))
            .map(child => child.position)

        const orderPositions = this.getPrefab("/vip_order_spots")
            .children
            .filter(child => child.id.startsWith("lvl_"))
            .map(child => child
                .children
                .filter(child => child.id.startsWith("spawn_"))
                .map(child => child.position))

        const vipCustomerSpawner = new VIPCustomerSpawner(spawnPositions, orderPositions)
        vipCustomerSpawnerObject.addComponent(vipCustomerSpawner)

        // VIP customer spawner created
    }

    /**
     * Create drive-thru system for testing the new Three.js implementation
     */
    private createDriveThru(): void {
        const costKey = "drive_thru"
        const driveThru0 = this.instantiate("/drivethru_station_0")
        const purchaseArea = driveThru0.getDescendantByPathOrThrow("purchase_area")
        const purchaseAreaComponent = this.addPurchaseAreaComponent(
            purchaseArea,
            {
                costKey: costKey,
                label: "Drive-Thru"
            },
        )

        // Create spline from prefab waypoints (similar to CheckoutStation pattern)
        const driveThruSpline = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 20,
            tension: 0.5,
            closed: false,
        })

        const waypoints = this.getPrefab("/drivethru_line")
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)

        driveThruSpline.setWaypoints(waypoints)

        const driveThru = new Drivethru(
            driveThru0,
            purchaseAreaComponent,
            driveThruSpline,
            costKey,
            BurgerShopDemo.getSharedMaterial(),
        )
        driveThru0.gameObject.addComponent(driveThru)

        // Store reference to drive-thru component so we can access its car manager
        this.driveThru = driveThru
    }

    /**
     * Create drive-thru cashier station with proper unlock integration
     */
    private createDriveThruCashierStation(): void {
        // Create drive-thru cashier station object
        const driveThruCashierStationObject = new GameObject("DriveThruCashier")

        // Create drive-thru cashier station component linked to drive-thru
        this.driveThruCashierStation = new CashierStation(
            this.driveThru, // Parent that can have cashier
            "drive_thru_cashier", // Cost key
        )
        driveThruCashierStationObject.addComponent(this.driveThruCashierStation)
    }

    /**
     * Create upgrade station
     */
    private createUpgradeStation(): void {
        const upgradeStationPrefabInstance = this.instantiate("upgrade_station_0")

        this.upgradeStation = new UpgradeStation(upgradeStationPrefabInstance, "upgrade_station")
        upgradeStationPrefabInstance.gameObject.addComponent(this.upgradeStation)

        // Use pre-initialized manager from systems initialization
        this.upgradeStation.setUpgradeManager(this.upgradeManager)
    }

    /**
     * Create HR station (locked initially, unlocks after upgrade station is built)
     */
    private createHRStation(): void {
        const hrStationInstance = this.instantiate("hr_station_0")

        this.hrStation = new HRStation(hrStationInstance, "hr_station")
        hrStationInstance.gameObject.addComponent(this.hrStation)

        // Use pre-initialized manager from systems initialization
        this.hrStation.setHRManager(this.hrUpgradeManager)
    }

    private addPurchaseAreaComponent(purchaseArea: PrefabInstance, options: { costKey: string, label: string }) {
        const boxData = purchaseArea.prefabNode.getComponentData<BoxComponentJSON>("box")
        let purchaseAreaSize: THREE.Vector3
        if (boxData) {
            purchaseAreaSize = new THREE.Vector3(boxData.size[0], boxData.size[1], boxData.size[2])
        } else {
            purchaseAreaSize = new THREE.Vector3(3.5, 3.5, 3.5)
        }
        const purchaseAreaComponent = new PurchaseArea(
            CostManager.getCost(options.costKey),
            new THREE.Vector2(purchaseAreaSize.x, purchaseAreaSize.z),
            options.label
        )
        purchaseArea.gameObject.addComponent(purchaseAreaComponent)
        return purchaseAreaComponent
    }

    /**
     * Create expansion station (unlocks environment upgrades)
     */
    private createExpansionStation(): void {
        // Get position from restaurant prefab
        const expansionPrefab = this.getPrefab("/expansion_1")
        const position = expansionPrefab.position

        const expansionStationObject = new GameObject("Expansion")
        expansionStationObject.position.set(position.x, position.y, position.z)
        // GameObject automatically adds itself to the scene in constructor

        this.expansionStation = new ExpansionStation()
        expansionStationObject.addComponent(this.expansionStation)

        // Connect camera for UI updates
        this.expansionStation.setCameraForUI(this.camera)

        // Expansion station created
    }

    /**
     * Create patio station (unlocks outdoor patio area)
     */
    private createPatioStation(): void {
        const patioObject = new GameObject("Patio")
        // Create the patio station component with config
        this.patioStation = new PatioStation("patio_station")
        patioObject.addComponent(this.patioStation)

        // Connect camera for UI updates
        this.patioStation.setCameraForUI(this.camera)
    }

    /**
     * Create second expansion station (unlocks next environment level)
     */
    private createExpansionStation2(): void {
        // Get position from restaurant prefab
        const expansionPrefab = this.getPrefab("/expansion_2")
        const position = expansionPrefab.position

        const expansionStationObject2 = new GameObject("Expansion 2")
        expansionStationObject2.position.set(position.x, position.y, position.z)
        // GameObject automatically adds itself to the scene in constructor

        this.expansionStation2 = new ExpansionStation("expansion_station_2")
        expansionStationObject2.addComponent(this.expansionStation2)

        // Connect camera for UI updates
        this.expansionStation2.setCameraForUI(this.camera)

        // Second expansion station created
    }

    /**
     * Create self-checkout station (for customer self-service)
     */
    private createSelfCheckoutStation(): void {
        // Create splines for self-checkout customer lines (two lines for two kiosks)
        const lineSpline1 = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 7,
            closed: false,
        })

        const selfCheckoutLinePrefab = this.getPrefab("/self_checkout_line_0")
        const selfCheckoutLine1 = selfCheckoutLinePrefab
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)
        lineSpline1.setWaypoints(selfCheckoutLine1)

        // Get customer line position from prefab
        const customerLinePosition = new THREE.Vector3(
            selfCheckoutLinePrefab.position.x,
            selfCheckoutLinePrefab.position.y,
            selfCheckoutLinePrefab.position.z
        )

        // Create self-checkout station component with both splines and purchase area position
        const selfCheckoutObject = new GameObject("SelfCheckout")
        this.selfCheckoutStation = new SelfCheckoutStation(lineSpline1, customerLinePosition, this.shakeStation)
        selfCheckoutObject.addComponent(this.selfCheckoutStation)

        // Connect camera for UI updates
        this.selfCheckoutStation.setCameraForUI(this.camera)

        // Self-checkout station created
    }

    /**
     * Create bathroom station (for future functionality)
     */
    private createBathroomStations(): void {
        const costKey = "bathroom_station"
        let bathroomStationInstance = this.instantiate("/bathroom_station_0")
        let bathroomStationObject = bathroomStationInstance.gameObject

        // Get purchase area position from restaurant prefab
        const bathroomPurchasePrefab = this.getPrefab("/bathroom_purchase_area")
        const purchaseAreaPosition = new THREE.Vector3(
            bathroomPurchasePrefab.position.x,
            bathroomPurchasePrefab.position.y,
            bathroomPurchasePrefab.position.z
        )

        // Create spline for bathroom line
        let lineSpline = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 7,
            closed: false,
        })

        let bathroomLine = this.getPrefab("/customer_line_bathroom_0")
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)
        lineSpline.setWaypoints(bathroomLine)

        // Create bathroom station component with purchase area position from prefab
        this.bathroomStation = new BathroomStation(bathroomStationInstance, costKey + "_0", lineSpline, 1, purchaseAreaPosition)
        bathroomStationObject.addComponent(this.bathroomStation)


        bathroomStationInstance = this.instantiate("/bathroom_station_1")
        bathroomStationObject = bathroomStationInstance.gameObject

        // Create spline for bathroom line
        lineSpline = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 7,
            closed: false,
        })

        bathroomLine = this.getPrefab("/customer_line_bathroom_1")
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)
        lineSpline.setWaypoints(bathroomLine)

        // Create bathroom station component (no prefab position - uses offset calculation)
        // Add bathroom_purchase_area_1 to prefab if you want to use prefab position for second bathroom
        this.bathroomStation2 = new BathroomStation(bathroomStationInstance, costKey + "_1", lineSpline, 3)
        bathroomStationObject.addComponent(this.bathroomStation2)
    }

    /**
     * Create shake station config factory
     */
    private createShakeStationConfig(prefabInstance: PrefabInstance, costKey: string, displayName: string, upgradeStartUnlocked: boolean): ProductionStationConfig {

        const stationDisplay = prefabInstance.getDescendantByPathOrThrow("station_display")
        const purchaseArea = prefabInstance.getDescendantByPathOrThrow("purchase_area")
        const shakeDisplay = stationDisplay.getDescendantByPathOrThrow("shake_display")
        const counterDisplay = stationDisplay.getDescendantByPathOrThrow("counter_display")
        const upgradeArea = stationDisplay.getDescendantByPathOrThrow("upgrade_area")
        return {
            stationComponentsObject: stationDisplay.gameObject,
            mainObject: shakeDisplay.gameObject,
            counterObject: counterDisplay.gameObject,
            purchaseAreaObject: purchaseArea.gameObject,
            upgradeObject: upgradeArea.gameObject,
            stackPositions: [
                new THREE.Vector3(0.4, 1.5, 0),
                new THREE.Vector3(-0.4, 1.5, 0),
            ],
            itemFactory: () => new Shake(BurgerShopDemo.getSharedMaterial()),
            productionDurations: SHAKE_PRODUCTION_DURATIONS,
            maxInventory: SHAKE_MAX_INVENTORY,
            visualComponentsFactory: undefined,
            upgradeMeshNames: [
                "restaurant_display_Prop_ShakeMachine_L1",
                "restaurant_display_Prop_ShakeMachine_L2",
                "restaurant_display_Prop_ShakeMachine_L3",
                "restaurant_display_Prop_ShakeMachine_L4",
            ],
            upgradeCostKeys: ["shake_upgrade_1", "shake_upgrade_2", "shake_upgrade_3"],
            upgradeLabel: "Blender Upgrade",
            upgradeStartUnlocked,
            costKey,
            displayName,
            purchaseAreaLabel: "Blender",
            purchaseAreaSize: new THREE.Vector2(5, 3.5),
            interactionZonePosition: new THREE.Vector3(2, 0, 0),
            interactionZoneSize: { width: 4, depth: 3.5 },
            upgradePosition: new THREE.Vector3(4.5, 0, 0),
            pickupSoundName: "pick up",
            sharedMaterial: BurgerShopDemo.getSharedMaterial()
        }
    }

    /**
     * Create shake station (first station)
     */
    private createShakeStation(): void {
        const shakeStationPrefabInstance = this.instantiate("/shake_station_0")
        const shakeStationObject = shakeStationPrefabInstance.gameObject

        this.shakeStation = new ProductionStation(this.createShakeStationConfig(
            shakeStationPrefabInstance,
            "shake_station",
            "Shake Station",
            false
        ))
        shakeStationObject.addComponent(this.shakeStation)
        this.shakeStation.setCameraForUI(this.camera)
    }

    /**
     * Create shake checkout station
     */
    private createShakeCheckout(): void {

        const shakeCheckout = this.instantiate("/checkout_station_1")
        const shakeCheckoutObject = shakeCheckout.gameObject

        // Create a spline for the customer line (extends backward from checkout)
        const lineSpline = new SplineThree({
            type: SplineTypeThree.CATMULL_ROM,
            resolution: 7,
            closed: false,
        })

        const waypoints = this.getPrefab("/customer_line_shake")
            .children
            .filter(child => child.id.startsWith("waypoint_"))
            .map(child => child.position)

        lineSpline.setWaypoints(waypoints)

        const config: CheckoutStationConfig = {
            prefabInstance: shakeCheckout,
            itemType: ItemTypes.SHAKE,
            itemIcon: "🥤",
            costKey: "shake_checkout",
            displayName: "Shake Checkout",
            purchaseAreaSize: new THREE.Vector2(3.5, 6),
            dropoffZonePosition: new THREE.Vector3(-1.35, 0, 0.1),
            dropoffZoneSize: { width: 4, depth: 4 },
            stackPositions: [
                new THREE.Vector3(-1.35, 1.57, 0.1)
            ],
            dropoffAudioClip: "place burgers",
            checkoutZonePosition: new THREE.Vector3(1.3, 0, 2.5),
            checkoutZoneSize: { width: 2, depth: 2 },
            moneyPilePosition: new THREE.Vector3(-4.0, 0, 0),
            itemPriceCostKey: "shake_price",
            customerLinePosition: new THREE.Vector3(1, 0, -2.2),
            lineSpline: lineSpline,
            lineSpacing: 2.0,
            audioClips: ["place burgers", "cash register"]
        }

        this.shakeCheckout = new CheckoutStation(config)
        shakeCheckoutObject.addComponent(this.shakeCheckout)
    }

    /**
     * Create shake checkout cashier station
     */
    private createShakeCheckoutCashierStation(): void {
        const cashierStationObject = new GameObject("Shake Cashier")

        this.shakeCheckoutCashierStation = new CashierStation(
            this.shakeCheckout,
            "shake_cashier",
            ["shake_cashier_speed_1", "shake_cashier_speed_2"],
        )
        cashierStationObject.addComponent(this.shakeCheckoutCashierStation)
    }

    /**
     * Create second shake station
     */
    private createShakeStation2(): void {

        const shakeCheckout = this.instantiate("/shake_station_1")
        const shakeStationObject = shakeCheckout.gameObject

        this.shakeStation2 = new ProductionStation(this.createShakeStationConfig(
            shakeCheckout,
            "shake_station_2",
            "Shake Station 2",
            true
        ))
        shakeStationObject.addComponent(this.shakeStation2)
        this.shakeStation2.setCameraForUI(this.camera)
    }

    /**
     * Setup all game costs in the CostManager (values from BurgerShopBalanceConfig)
     */
    private setupCosts(): void {
        // Starting money
        CostManager.setCost("starting_money", COST_STARTING_MONEY)

        // Initial purchase
        CostManager.setCost("initial_shop", COST_INITIAL_SHOP)

        // Core stations
        CostManager.setCost("burger_station", COST_BURGER_STATION)
        CostManager.setCost("burger_station_2", COST_BURGER_STATION_2)
        CostManager.setCost("grill_station", COST_GRILL_STATION)
        CostManager.setCost("checkout_station", COST_CHECKOUT_STATION)

        // Tables
        CostManager.setCost("table1", COST_TABLE_1)
        CostManager.setCost("table2", COST_TABLE_2)
        CostManager.setCost("table3", COST_TABLE_3)
        CostManager.setCost("table4", COST_TABLE_4)
        CostManager.setCost("table5", COST_TABLE_5)
        CostManager.setCost("table6", COST_TABLE_6)
        CostManager.setCost("table7", COST_TABLE_7)
        CostManager.setCost("table8", COST_TABLE_8)
        CostManager.setCost("table9", COST_TABLE_9)
        CostManager.setCost("table10", COST_TABLE_10)
        CostManager.setCost("table11", COST_TABLE_11)
        CostManager.setCost("table12", COST_TABLE_12)
        CostManager.setCost("table13", COST_TABLE_13)
        CostManager.setCost("table14", COST_TABLE_14)
        CostManager.setCost("table15", COST_TABLE_15)

        // Advanced features
        CostManager.setCost("hr_station", COST_HR_STATION)
        CostManager.setCost("upgrade_station", COST_UPGRADE_STATION)
        CostManager.setCost("drive_thru", COST_DRIVE_THRU)
        CostManager.setCost("cashier", COST_CASHIER)
        CostManager.setCost("drive_thru_cashier", COST_DRIVE_THRU_CASHIER)
        CostManager.setCost("expansion_station", COST_EXPANSION_STATION)
        CostManager.setCost("expansion_station_2", COST_EXPANSION_STATION_2)
        CostManager.setCost("expansion_station_3", COST_EXPANSION_STATION_3)
        CostManager.setCost("patio_station", COST_PATIO_STATION)
        CostManager.setCost("self_checkout_station", COST_SELF_CHECKOUT_STATION)
        CostManager.setCost("bathroom_station_0", COST_BATHROOM_STATION)
        CostManager.setCost("bathroom_station_1", COST_BATHROOM_STATION_2)

        // Burger sale prices
        CostManager.setCost("burger_price", COST_BURGER_PRICE)
        CostManager.setCost("drive_thru_burger_price", COST_DRIVE_THRU_BURGER_PRICE)
        CostManager.setCost("table_tip_min", COST_TABLE_TIP_MIN)
        CostManager.setCost("table_tip_max", COST_TABLE_TIP_MAX)
        CostManager.setCost("bathroom_tip_min", COST_BATHROOM_TIP_MIN)
        CostManager.setCost("bathroom_tip_max", COST_BATHROOM_TIP_MAX)

        // Employee costs
        COST_EMPLOYEE_HIRE.forEach((cost, i) => CostManager.setCost(`employee_${i + 1}`, cost))

        // Employee speed upgrade costs
        COST_EMPLOYEE_SPEED_UPGRADES.forEach((cost, i) => CostManager.setCost(`employee_speed_${i + 1}`, cost))

        // Employee inventory upgrade costs
        COST_EMPLOYEE_INVENTORY_UPGRADES.forEach((cost, i) => CostManager.setCost(`employee_inventory_${i + 1}`, cost))

        // Player speed upgrades
        COST_PLAYER_SPEED_UPGRADES.forEach((cost, i) => CostManager.setCost(`upgrade_speed_${i + 1}`, cost))

        // Player inventory upgrades
        COST_PLAYER_INVENTORY_UPGRADES.forEach((cost, i) => CostManager.setCost(`upgrade_inventory_${i + 1}`, cost))

        // Player profit upgrades
        COST_PLAYER_PROFIT_UPGRADES.forEach((cost, i) => CostManager.setCost(`upgrade_profit_${i + 1}`, cost))

        // Grill upgrades
        COST_GRILL_UPGRADES.forEach((cost, i) => CostManager.setCost(`grill_upgrade_${i + 1}`, cost))

        // Shake station costs
        CostManager.setCost("shake_station", COST_SHAKE_STATION)
        CostManager.setCost("shake_station_2", COST_SHAKE_STATION_2)
        CostManager.setCost("shake_checkout", COST_SHAKE_CHECKOUT)
        CostManager.setCost("shake_cashier", COST_SHAKE_CASHIER)
        COST_SHAKE_UPGRADES.forEach((cost, i) => CostManager.setCost(`shake_upgrade_${i + 1}`, cost))
        CostManager.setCost("shake_price", COST_SHAKE_PRICE)

        // Cashier speed upgrades
        COST_CASHIER_SPEED_UPGRADES.forEach((cost, i) => CostManager.setCost(`cashier_speed_${i + 1}`, cost))
        COST_DRIVETHRU_CASHIER_SPEED_UPGRADES.forEach((cost, i) => CostManager.setCost(`drivethru_cashier_speed_${i + 1}`, cost))
        COST_SHAKE_CASHIER_SPEED_UPGRADES.forEach((cost, i) => CostManager.setCost(`shake_cashier_speed_${i + 1}`, cost))
    }

    /**
     * Setup unlock dependencies with initial shop purchase as the first purchase
     */
    private setupUnlocks(): void {
        UnlockManager.register(this.initialShopPurchase, [])
        UnlockManager.register(this.tables[0], [this.initialShopPurchase])
        UnlockManager.register(this.checkoutStation, [this.tables[0]])
        UnlockManager.register(this.burgerStation, [this.checkoutStation])
        UnlockManager.register(this.cashierStation, [this.burgerStation])
        UnlockManager.register(this.tables[1], [this.cashierStation])
        UnlockManager.register(this.hrStation, [this.tables[1]])
        UnlockManager.register(this.upgradeStation, [this.hrStation])
        UnlockManager.register(this.driveThru, [this.upgradeStation])
        UnlockManager.register(this.burgerStation.getLevelComponent(), [this.driveThru])
        // Cashier speed upgrades unlock after HR station
        UnlockManager.register(this.cashierStation.getLevelComponent()!, [this.driveThru])
        UnlockManager.register(this.tables[2], [this.tables[1]])
        UnlockManager.register(this.driveThruCashierStation, [this.driveThru])
        UnlockManager.register(this.driveThruCashierStation.getLevelComponent()!, [this.driveThruCashierStation])
        UnlockManager.register(this.burgerStation2, [this.driveThru])
        UnlockManager.register(this.expansionStation, [this.driveThru])
        UnlockManager.register(this.selfCheckoutStation, [this.expansionStation])
        UnlockManager.register(this.bathroomStation, [this.expansionStation])
        UnlockManager.register(this.patioStation, [this.expansionStation])
        UnlockManager.register(this.tables[5], [this.patioStation])
        UnlockManager.register(this.tables[6], [this.tables[5]])
        UnlockManager.register(this.expansionStation2, [this.selfCheckoutStation, this.bathroomStation, this.patioStation])
        UnlockManager.register(this.tables[3], [this.tables[2], this.expansionStation2])
        UnlockManager.register(this.tables[4], [this.tables[3]])
        // IN PROGRESS AFTER THIS
        UnlockManager.register(this.tables[7], [this.tables[4]])
        UnlockManager.register(this.bathroomStation2, [this.expansionStation2])
        UnlockManager.register(this.trashCans[1], [this.expansionStation2])

        UnlockManager.register(this.tables[8], [this.tables[7]])
        UnlockManager.register(this.tables[9], [this.tables[8]])
        UnlockManager.register(this.tables[10], [this.tables[9]])
        UnlockManager.register(this.tables[11], [this.tables[10]])
        UnlockManager.register(this.tables[12], [this.tables[11]])

        // Shake stations (unlocked after expansion 3)
        UnlockManager.register(this.shakeStation, [this.expansionStation2])
        UnlockManager.register(this.shakeCheckout, [this.shakeStation])
        UnlockManager.register(this.shakeStation.getLevelComponent(), [this.shakeStation, this.shakeCheckout])
        UnlockManager.register(this.shakeCheckoutCashierStation, [this.shakeCheckout])
        UnlockManager.register(this.shakeCheckoutCashierStation.getLevelComponent()!, [this.shakeCheckoutCashierStation])
        UnlockManager.register(this.shakeStation2, [this.shakeCheckout])

        // Set tutorial steps after all stations are created
        if (this.tutorialSystem) {
            const tutorialSteps = this.setupTutorialSteps()
            // Steps 0-9 are linear (blocking), step 10+ are parallel (non-blocking)
            this.tutorialSystem.setTutorialSteps(tutorialSteps, 10)
        }

        // Unlock highlight system initialized earlier after camera setup
    }

    /**
     * Setup tutorial steps in LINEAR ORDER matching unlock progression
     * Each step only shows when the previous step is completed
     */
    private setupTutorialSteps(): TutorialStep[] {
        const tracker = this.tutorialSystem?.getTracker()
        if (!tracker) return []

        return [
            {
                id: "purchase_burger_shop",
                description: "Buy the burger shop",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.initialShopPurchase?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return this.initialShopPurchase
                        ? UnlockManager.isAcquired(this.initialShopPurchase)
                        : false
                },
            },
            {
                id: "buy_table",
                description: "Get a table",
                targetPosition: this.tables[0]?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return this.tables[0] && UnlockManager.isAcquired(this.tables[0])
                },
            },
            {
                id: "buy_checkout_station",
                description: "Build a checkout counter",
                targetPosition: this.checkoutStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return (
                        this.checkoutStation && UnlockManager.isAcquired(this.checkoutStation)
                    )
                },
            },
            {
                id: "buy_cooking_station",
                description: "Get a grill",
                targetPosition: this.burgerStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return this.burgerStation && UnlockManager.isAcquired(this.burgerStation)
                },
            },
            {
                id: "pickup_burgers",
                description: "Pick up burgers",
                targetPosition: this.burgerStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return tracker.getBurgersPickedUp() > 0
                },
            },
            {
                id: "deliver_burgers",
                description: "Bring burgers to checkout",
                targetPosition: this.checkoutStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return tracker.getBurgersDeliveredToCheckout() > 0
                },
            },
            {
                id: "checkout_customers",
                description: "Serve customers at register",
                targetPosition: this.checkoutStation?.getCheckoutZoneGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return tracker.getCustomersServed() > 0
                },
            },
            {
                id: "clean_table",
                description: "Clean the dirty table",
                targetPosition: () => {
                    // Dynamically find occupied table (dirty or with eating customers)
                    const table = BurgerShopDirectory.findOccupiedTable()
                    return table?.getGameObject().getWorldPosition(new THREE.Vector3())
                },
                displayCondition: () => {
                    // Show as soon as any table is occupied (eating or needs cleaning)
                    return tracker.hasOccupiedTables()
                },
                completeCondition: () => {
                    return tracker.getTrashPickedUpFromTables() > 0
                },
            },
            {
                id: "dispose_trash",
                description: "Put trash in trash can",
                targetPosition: this.trashCans[0]?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return tracker.getTrashDisposedInTrashCan() > 0
                },
            },
            {
                id: "buy_cashier_station",
                description: "Hire a cashier to help",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.cashierStation?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return (
                        this.cashierStation && UnlockManager.isAcquired(this.cashierStation)
                    )
                },
            },
            {
                id: "buy_table_2",
                description: "Add more tables",
                targetPosition: this.tables[1]?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return this.tables[1] && UnlockManager.isAcquired(this.tables[1])
                },
            },
            {
                id: "buy_hr_station",
                description: "Unlock HR",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.hrStation?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return this.hrStation && UnlockManager.isAcquired(this.hrStation)
                },
            },
            {
                id: "hire_employee",
                description: "Hire an employee",
                targetPosition: this.hrStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    if (!this.hrStation || !UnlockManager.isAcquired(this.hrStation)) {
                        return false
                    }
                    return this.hrStation.getHRManager().getEmployeeCount() >= 1
                },
            },
            {
                id: "buy_upgrade_station",
                description: "Upgrade your character",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.upgradeStation?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return this.upgradeStation && UnlockManager.isAcquired(this.upgradeStation)
                },
            },
            {
                id: "get_inventory_upgrade",
                description: "Upgrade to carry more items",
                targetPosition: this.upgradeStation?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    if (!this.upgradeStation || !UnlockManager.isAcquired(this.upgradeStation)) {
                        return false
                    }
                    return this.upgradeStation.getUpgradeManager().getInventoryLevel() >= 1
                },
            },
            {
                id: "buy_drive_thru",
                description: "Purchase a drive-thru",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.driveThru?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return this.driveThru && UnlockManager.isAcquired(this.driveThru)
                },
            },
            {
                id: "serve_customers_at_drive_thru",
                description: "Serve customers at the drive-thru",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.driveThru?.getHighlightPosition(pos)
                    return pos
                })(),
                displayCondition: () => {
                    return this.driveThru && UnlockManager.isAcquired(this.driveThru)
                },
                completeCondition: () => {
                    return this.driveThru?.getInventoryCount() > 0
                }
            },
            /*
            {
                id: "buy_drive_thru_cashier",
                description: "Hire a cashier for the drive-thru",
                targetPosition: (() => {
                    const pos = new THREE.Vector3()
                    this.driveThruCashierStation?.getHighlightPosition(pos)
                    return pos
                })(),
                completeCondition: () => {
                    return (
                        this.driveThruCashierStation &&
                        UnlockManager.isAcquired(this.driveThruCashierStation)
                    )
                },
            },
            {
                id: "buy_table_3",
                description: "Buy another table",
                targetPosition: this.tables[2]?.getGameObject().getWorldPosition(new THREE.Vector3()),
                completeCondition: () => {
                    return this.tables[2] && UnlockManager.isAcquired(this.tables[2])
                },
            },
            */
        ]
    }

    /**
     * Update method - called every frame
     */
    protected preRender(deltaTime: number): void {
        // Animation: Each character updates their own mixer via AnimationGraphComponent.update()
        // (We tried shared AnimationObjectGroup but it had issues with some animations)
        
        // Tutorial system now updates automatically as a component via ComponentUpdater

        // Update world-space UI elements
        UISystem.updateWorldSpaceElements(this.camera)

        AssetManager.updateDynamicGPUBatches(this.camera)

        // Shadows are static to avoid jitter on mobile
    }

    /**
     * Enable or disable free camera mode (debug feature)
     * @param enabled Whether to enable free camera controls
     */
    public setFreeCameraEnabled(enabled: boolean): void {
        if (this.cameraManager) {
            this.cameraManager.setFreeCameraEnabled(enabled)
        }
    }

    /**
     * Get whether free camera is currently enabled
     */
    public isFreeCameraEnabled(): boolean {
        return this.cameraManager ? this.cameraManager.isFreeCameraEnabled() : false
    }

    /**
     * Get the main camera (for debug display)
     */
    public getCamera(): THREE.PerspectiveCamera {
        return this.camera
    }

    /**
     * Toggle camera mode between follow and free
     */
    public toggleCameraMode(): void {
        if (this.cameraManager) {
            this.cameraManager.toggleCameraMode()
        }
    }

    /**
     * Clean up when the game ends
     */
    protected async onDispose(): Promise<void> {
        // Camera cleanup is handled by the component system automatically

        // Clean up debug panel
        if (this.debugPanel) {
            this.debugPanel.dispose()
        }

        // Post-processing cleanup is handled by VenusGame
    }
}
