import * as THREE from "three"
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"
import { StowKitSystem } from "@series-inc/rundot-3d-engine/systems"
import { UnlockManager, UnlockableComponent } from "@game/money"
import { DynamicNavSystem, PrefabLoader } from "@series-inc/rundot-3d-engine/systems"
import { RigidBodyComponentThree } from "@series-inc/rundot-3d-engine/systems"

interface PendingEnvironmentSwap {
    newEnvironment: GameObject
    oldEnvironment: GameObject | null
}


/**
 * Environment component that changes visual level based on specific unlock requirements
 * Progresses through Level_0, Level_1, Level_2, Level_3 as specific features are unlocked
 * Each index in the levelUnlocks array represents the unlock required for that level (1, 2, 3, etc.)
 */
export class BurgerShopEnvironment extends Component {
    private currentLevel: number = 0
    private currentEnvironmentInstance: GameObject | null = null
    private levelUnlocks: UnlockableComponent[] = []
    private acquireListener: ((acquiredItem: UnlockableComponent, newlyUnlocked: UnlockableComponent[]) => void) | null = null
    private meshComponent: any
    
    // Pending environment swap - waits for new environment to fully load before removing old
    private pendingSwap: PendingEnvironmentSwap | null = null

    constructor(levelUnlocks: UnlockableComponent[] = []) {
        super()
        this.levelUnlocks = levelUnlocks
    }

    protected onCreate(): void {
        // Load shared environment prefab (contains common elements, roads, sidewalks)
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const sharedEnvPrefab = prefabCollection.getPrefabByName("shared_environment")
        if (sharedEnvPrefab) {
            PrefabLoader.instantiatePrefab(sharedEnvPrefab, this.gameObject, { castShadow: false })
        } else {
            console.warn("shared_environment prefab not found, falling back to mesh only")
            const commonEnvironment = new GameObject("CommonEnvironment")
            this.meshComponent = new MeshRenderer("restaurant_display_common")
            commonEnvironment.addComponent(this.meshComponent)
            this.gameObject.add(commonEnvironment)
        }

        // Determine initial level based on current unlock state
        this.currentLevel = this.calculateCurrentLevel()

        // Create the initial environment display
        this.updateEnvironmentDisplay()

        // Listen for unlock events to update the environment
        this.setupUnlockListeners()

        this.setupRoadNavigationObstacles()
    }

    private setupRoadNavigationObstacles(): void {
        // Road navigation obstacles
        DynamicNavSystem.addBoxObstacle(28, -45, 47, 15)
        DynamicNavSystem.addBoxObstacle(-37, -45, 47, 15)

        // Drive-thru navigation obstacles
        DynamicNavSystem.addBoxObstacle(30, -5, 10, 70)
        DynamicNavSystem.addBoxObstacle(-50, -5, 10, 70)
    }

    /**
     * Calculate which level the environment should be at based on specific unlock requirements
     * Index in levelUnlocks array determines the level (0 = Level 1, 1 = Level 2, etc.)
     */
    private calculateCurrentLevel(): number {
        let highestLevel = 0

        // Check each unlock requirement (index = level - 1)
        for (let i = 0; i < this.levelUnlocks.length; i++) {
            const unlockable = this.levelUnlocks[i]
            if (UnlockManager.isAcquired(unlockable)) {
                highestLevel = i + 1 // Level is index + 1
            }
        }

        return highestLevel
    }

    /**
     * Update the environment display to match the current level
     * Instantiates prefab with physics and navigation obstacles
     * Waits for all meshes to load before removing old environment to prevent flash
     */
    private updateEnvironmentDisplay(): void {
        // Keep reference to old environment for cleanup after new one is ready
        const oldEnvironmentInstance = this.currentEnvironmentInstance

        // Prefabs are named environment_1 through environment_6 (level + 1)
        const prefabName = `new_environment_${this.currentLevel + 1}`
        console.log("Loading environment prefab:", prefabName)
        
        // Instantiate the prefab for the current level
        try {
            const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
            const prefab = prefabCollection.getPrefabByName(prefabName)
            if (!prefab) {
                throw new Error(`Prefab "${prefabName}" not found in collection`)
            }
            const instance = PrefabLoader.instantiatePrefab(prefab, this.gameObject)
            this.currentEnvironmentInstance = instance.gameObject

            // Add navigation obstacles for all GameObjects with RigidBody components
            this.setupNavigationObstacles(this.currentEnvironmentInstance)

            // Check if all meshes are already loaded
            if (this.areAllMeshesLoaded(this.currentEnvironmentInstance)) {
                // All loaded immediately, destroy old environment now
                if (oldEnvironmentInstance) {
                    this.destroyEnvironmentInstance(oldEnvironmentInstance)
                }
            } else {
                // Set up pending swap - old environment will be removed once new one is fully loaded
                this.pendingSwap = {
                    newEnvironment: this.currentEnvironmentInstance,
                    oldEnvironment: oldEnvironmentInstance
                }
            }
        } catch (error) {
            console.error(`Failed to load environment prefab "${prefabName}" for level ${this.currentLevel}:`, error)
            throw error
        }
    }

    /**
     * Check if all MeshRenderer components in a GameObject tree are loaded
     */
    private areAllMeshesLoaded(root: GameObject): boolean {
        let allLoaded = true
        root.traverse((child) => {
            if (!(child instanceof GameObject)) return
            const meshComponent = child.getComponent(MeshRenderer)
            if (meshComponent && !meshComponent.isLoaded()) {
                allLoaded = false
            }
        })
        return allLoaded
    }

    /**
     * Update - checks for pending environment swaps
     */
    public update(_deltaTime: number): void {
        if (this.pendingSwap) {
            // Check if new environment is fully loaded
            if (this.areAllMeshesLoaded(this.pendingSwap.newEnvironment)) {
                // New environment ready - destroy the old one
                if (this.pendingSwap.oldEnvironment) {
                    this.destroyEnvironmentInstance(this.pendingSwap.oldEnvironment)
                }
                this.pendingSwap = null
            }
        }
    }

    /**
     * Setup navigation obstacles for all GameObjects with RigidBody components
     */
    private setupNavigationObstacles(environmentInstance: GameObject): void {
        // Traverse all children to find GameObjects with RigidBody components
        environmentInstance.traverse((child) => {
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

    /**
     * Destroy a specific environment instance and clean up physics/navigation
     */
    private destroyEnvironmentInstance(environmentInstance: GameObject): void {
        if (!environmentInstance) return

        // Remove navigation obstacles for all children with RigidBodyComponents
        environmentInstance.traverse((child) => {
            if (!(child instanceof GameObject)) return

            // Check if this child has a RigidBody component (indicates it has a nav obstacle)
            const rigidBody = child.getComponent(RigidBodyComponentThree)
            if (rigidBody) {
                // Remove the navigation obstacle for this GameObject
                DynamicNavSystem.removeObstacleByGameObject(child)
            }
        })

        // Dispose the environment GameObject (this will recursively cleanup all child components)
        environmentInstance.dispose()
    }

    /**
     * Destroy the current environment instance and clean up physics/navigation
     */
    private destroyCurrentEnvironment(): void {
        if (!this.currentEnvironmentInstance) return
        this.destroyEnvironmentInstance(this.currentEnvironmentInstance)
        this.currentEnvironmentInstance = null
    }

    /**
     * Listen for acquisition events to trigger environment updates
     */
    private setupUnlockListeners(): void {
        // Create and store listener reference for cleanup
        this.acquireListener = (acquiredItem: UnlockableComponent) => {
            // Check if the acquired item is one of our level unlock requirements
            const levelIndex = this.levelUnlocks.indexOf(acquiredItem)

            if (levelIndex !== -1) {
                // This is a level unlock requirement, recalculate level
                const newLevel = this.calculateCurrentLevel()
                
                if (newLevel !== this.currentLevel) {
                    this.currentLevel = newLevel
                    this.updateEnvironmentDisplay()
                }
            }
        }

        // Register the listener with UnlockManager
        UnlockManager.addAcquireListener(this.acquireListener)
    }

    /**
     * Get the current environment level
     */
    public getCurrentLevel(): number {
        return this.currentLevel
    }

    protected onCleanup(): void {
        // Clean up any pending swap
        if (this.pendingSwap?.oldEnvironment) {
            this.destroyEnvironmentInstance(this.pendingSwap.oldEnvironment)
        }
        this.pendingSwap = null

        // Clean up the environment instance
        this.destroyCurrentEnvironment()

        // Remove the acquire listener to prevent memory leaks
        if (this.acquireListener) {
            UnlockManager.removeAcquireListener(this.acquireListener)
            this.acquireListener = null
        }
    }
}
