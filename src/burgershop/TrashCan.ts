import * as THREE from "three"
import { Component, GameObject, InteractionZone, MeshRenderer } from "@series-inc/rundot-3d-engine"
import { AnimationUtils } from "@game/shared"
import {
  Audio2D,
  DynamicNavSystem,
  UIUtils,
} from "@series-inc/rundot-3d-engine/systems"
import { PlayerComponent } from "./PlayerComponent"
import { Employee } from "./employee/Employee"
import { IUnlockable, UnlockManager, GroundLabel, ArrowDirection } from "@game/money"
import { Trash } from "./Trash"
import { BurgerShopDirectory } from "./BurgerShopDirectory"
import { Timer } from "@game/Timer"
import { PrefabInstance } from "@game/prefabs"

/**
 * Three.js version of TrashCan component
 * Allows players and employees to dispose of trash items
 * Integrates with unlock system for progressive restaurant expansion
 */
export class TrashCan extends Component implements IUnlockable {
  private readonly stationDisplay: PrefabInstance
  private readonly trashCanObject: GameObject
  private readonly labelPrefabInstance: PrefabInstance | undefined

  private interactionZone!: InteractionZone
  private interactionZoneObject!: GameObject
  private entitiesInZone: Set<GameObject> = new Set()

  private audioComponent: Audio2D | null = null

  private collectItemsTimer = new Timer(0.15)
  
  private isLocked: boolean = false
  private labelDirection: ArrowDirection
  private navigationObstacleAdded: boolean = false
  private needsNavigationObstacle: boolean = false

  // World UI label
  private labelPlane: THREE.Mesh | null = null
  private labelCanvas: HTMLCanvasElement | null = null
  private labelTexture: THREE.CanvasTexture | null = null
  private flipLabel: boolean = false

  constructor(instance: PrefabInstance, cost: number | string | null = 50, flipLabel: boolean = false, labelDirection: ArrowDirection = "up") {
    super()
    // If cost is null, this trash can will be unlocked via the unlock system
    this.isLocked = cost === null
    this.flipLabel = flipLabel
    this.labelDirection = labelDirection
    this.stationDisplay = instance.getDescendantByPathOrThrow("/restaurant_display_trash")
    this.trashCanObject = this.stationDisplay.gameObject
    this.labelPrefabInstance = instance.getDescendantByPath("/label")
  }

  protected onCreate(): void {
    // Creating TrashCan

    // Setup interaction zone (under station components)
    this.setupInteractionZone()

    // Setup audio system
    this.setupAudio()

    // Setup ground label
    this.setupGroundLabel()

    if (this.isLocked) {
      // Start disabled - will be enabled when unlocked
      this.stationDisplay.gameObject.setEnabled(false)
    } else {
      // Trash can starts already unlocked and enabled
      this.stationDisplay.gameObject.setEnabled(true)

      // Register with directory immediately since it's already active
      BurgerShopDirectory.registerTrashCan(this)

      // Add navigation obstacles immediately since trash can is active
      this.setupNavigationObstacles()
    }

    // TrashCan created
  }

  /**
   * Setup the interaction zone for player interaction
   */
  private setupInteractionZone(): void {
    this.interactionZoneObject = new GameObject("TrashCanInteractionZone")
    this.interactionZoneObject.position.set(0, 0, 0) // Centered on trash can
    this.stationDisplay.gameObject.add(this.interactionZoneObject)

    this.interactionZone = new InteractionZone(
      (other: GameObject) => this.onEntityEnter(other),
      (other: GameObject) => this.onEntityExit(other),
      {
        width: 4.5, // Wide enough to cover trash can area
        depth: 5.5, // Deep enough for players to interact
        active: true,
        show: false,
      },
    )

    this.interactionZoneObject.addComponent(this.interactionZone)
    // Interaction zone created
  }

  /**
   * Setup the ground label for the trash can
   */
  private setupGroundLabel(): void {
    if (!this.labelPrefabInstance) return

    const groundLabel = new GroundLabel("TRASH", this.labelDirection, new THREE.Vector2(2.5, 2), "large")
    this.labelPrefabInstance.gameObject.addComponent(groundLabel)

    // Hide label initially if locked - will be shown when unlocked
    if (this.isLocked) {
      this.labelPrefabInstance.gameObject.visible = false
    }
  }

  /**
   * Create the world UI label showing "TRASH" above the trash can
   */
  private createWorldUILabel(): void {
    const labelWidth = 2.5 // Width in world units
    const labelHeight = 0.8 // Height in world units
    const heightOffset = 3.0 // Position above trash can

    // Create world UI using utility
    const worldUI = UIUtils.createWorldUI(labelWidth, labelHeight, {
      heightOffset: heightOffset,
      flipOrientation: false, // Face upward
    })

    this.labelPlane = worldUI.plane
    this.labelCanvas = worldUI.canvas
    this.labelTexture = worldUI.texture

    // Apply 180-degree rotation if flipLabel is true
    if (this.flipLabel) {
      this.labelPlane.rotation.z = Math.PI
    }

    // Add to the trash can display
    this.stationDisplay.gameObject.add(this.labelPlane)

    // Render the label text
    this.renderLabel()
  }

  /**
   * Render the "TRASH" label on the canvas
   */
  private renderLabel(): void {
    if (!this.labelCanvas) return

    const ctx = this.labelCanvas.getContext("2d")
    if (!ctx) return

    const width = this.labelCanvas.width
    const height = this.labelCanvas.height

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, width, height)

    // Draw "TRASH" text only (no background or border)
    ctx.fillStyle = "#844940"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `500 80px ${UIUtils.FONT_FAMILY}`
    ctx.fillText("TRASH", width / 2, height / 2)

    // Update texture
    if (this.labelTexture) {
      this.labelTexture.needsUpdate = true
    }
  }

  /**
   * Handle entity entering the interaction zone
   */
  private onEntityEnter(entityGameObject: GameObject): void {
    const playerComponent = entityGameObject.getComponent(PlayerComponent)
    const employeeComponent = entityGameObject.getComponent(Employee)

    if (playerComponent || employeeComponent) {
      this.entitiesInZone.add(entityGameObject)
    }
  }

  /**
   * Handle entity exiting the interaction zone
   */
  private onEntityExit(entityGameObject: GameObject): void {
    this.entitiesInZone.delete(entityGameObject)
  }

  /**
   * Update function called each frame
   */
  public update(deltaTime: number): void {
    this.collectItemsTimer.tick(deltaTime)
    // Try to dispose of trash from players and employees in the interaction zone
    this.tryDisposeTrashFromEntities()
    
    // Deferred navigation obstacle setup - wait for mesh to load
    if (this.needsNavigationObstacle && !this.navigationObstacleAdded) {
      this.trySetupNavigationObstacles()
    }
  }

  /**
   * Try to dispose of trash from players and employees in the interaction zone
   */
  private tryDisposeTrashFromEntities(): void {
    // Only proceed if we have entities in the zone
    if (this.entitiesInZone.size === 0) {
      return
    }

    if (this.collectItemsTimer.isRunning()) {
      return
    }

    // Try to dispose trash from each entity in the zone
    for (const entityGameObject of this.entitiesInZone) {
      const playerComponent = entityGameObject.getComponent(PlayerComponent)
      const employeeComponent = entityGameObject.getComponent(Employee)

      let entityInventory = null
      let entityType = ""

      if (playerComponent) {
        entityInventory = playerComponent.getInventory()
        entityType = "Player"
      } else if (employeeComponent) {
        entityInventory = employeeComponent.getInventory()
        entityType = "Employee"
      }

      if (!entityInventory || entityInventory.isEmpty()) continue

      // Check if entity has trash
      if (!entityInventory.hasItemOfType(Trash.ITEM_TYPE)) continue

      // Try to remove a trash item from entity inventory
      const trashItem = entityInventory.removeItem(Trash.ITEM_TYPE)
      if (trashItem) {
        // Play trash disposal sound
        if (this.audioComponent) {
          this.audioComponent.play("trash")
        }

        // Start squash bounce immediately when trash starts moving
        AnimationUtils.squashBounce(this.trashCanObject)

        trashItem.animateToPosition(
          this.trashCanObject,
          () => {
            // Destroy the trash item
            trashItem.getGameObject().dispose()

            // Record trash disposal for tutorial tracking
            const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
            if (tutorialSystem) {
              tutorialSystem.getTracker().recordTrashDisposed()
            }
          },
        )

        // Only dispose one item per timer frame
        this.collectItemsTimer.reset()
        break
      }
    }
  }

  /**
   * Setup the audio system for trash disposal sounds
   */
  private setupAudio(): void {
    this.audioComponent = new Audio2D(["trash"])
    this.gameObject.addComponent(this.audioComponent)
  }

  // IUnlockable implementation

  public unlock(): void {
    // For locked trash cans, this is called when they become available
    // Free trash cans with no purchase needed go straight to acquire()
    if (this.isLocked) {
      // Enable the trash can
      this.stationDisplay.gameObject.setEnabled(true)
      
      // Show the ground label
      if (this.labelPrefabInstance) {
        this.labelPrefabInstance.gameObject.visible = true
      }
      
      // Register with directory
      BurgerShopDirectory.registerTrashCan(this)
      
      // Add navigation obstacles
      this.setupNavigationObstacles()
      
      // Mark as no longer locked
      this.isLocked = false
      
      // Immediately acquire since there's no purchase needed (it's free)
      UnlockManager.acquire(this)
    }
  }

  public acquire(): void {
    // Record trash acquisition for tutorial tracking (for consistency)
    const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
    if (tutorialSystem) {
      tutorialSystem.getTracker().recordTrashAcquired()
    }
  }

  public getCost(): number {
    return 0 // Trash can is free now
  }

  public getDisplayName(): string {
    return "Trash Can"
  }

  public getUnlockableId(): string {
    return this.getGameObject().name
  }

  /**
   * Mark that navigation obstacles need to be set up (called when trash can becomes active)
   */
  private setupNavigationObstacles(): void {
    this.needsNavigationObstacle = true
    // Try immediately in case mesh is already loaded
    this.trySetupNavigationObstacles()
  }

  /**
   * Try to setup navigation obstacles - succeeds when mesh is loaded
   */
  private trySetupNavigationObstacles(): void {
    if (this.navigationObstacleAdded) return

    // Add navigation obstacle for the trash can
    const trashMeshComponent = this.trashCanObject.getComponent(MeshRenderer)
    if (trashMeshComponent && trashMeshComponent.isLoaded()) {
      const trashCanBounds = trashMeshComponent.getBounds()
      if (trashCanBounds) {
        DynamicNavSystem.addBoxObstacleFromBounds(
          this.trashCanObject,
          trashCanBounds,
        )
        this.navigationObstacleAdded = true
        this.needsNavigationObstacle = false
      }
    }
  }

  /**
   * Expose the interaction zone gameobject so AI can target its world position
   */
  public getInteractionZoneObject(): GameObject {
    return this.interactionZoneObject
  }

  /**
   * Clean up resources
   */
  protected onCleanup(): void {
    // Clean up label UI resources
    if (this.labelPlane) {
      this.labelPlane.geometry.dispose()
      if (this.labelPlane.material instanceof THREE.Material) {
        this.labelPlane.material.dispose()
      }
    }

    if (this.labelTexture) {
      this.labelTexture.dispose()
      this.labelTexture = null
    }

    this.labelCanvas = null

    super.onCleanup()
  }
}
